"""foodpanda phase-one API and same-origin frontend. No simulated persistence."""
import hmac
import os
import secrets
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from functools import wraps
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, current_app, g, jsonify, request, session, send_from_directory
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash
import pymysql

from .db import close_db, query, execute, transaction
from .completion import schedule_completion

ROOT = Path(__file__).resolve().parents[1]
HK = timezone(timedelta(hours=8))
PREFIX = '/api/v1'


class APIError(Exception):
    def __init__(self, status, code, message):
        self.status, self.code, self.message = status, code, message


def fail(status, code, message):
    raise APIError(status, code, message)


def body(required=(), optional=()):
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or set(data) - set(required) - set(optional) or set(required) - set(data):
        fail(400, 'VALIDATION_ERROR', 'Invalid or missing JSON fields.')
    return data


def integer(value, maximum=9007199254740991):
    if type(value) is not int or not 0 < value <= maximum:
        fail(400, 'VALIDATION_ERROR', 'Expected a positive integer in range.')
    return value


def cents(value):
    return int(Decimal(value) * 100)


def stamp(value):
    return value.replace(tzinfo=HK).isoformat(timespec='seconds')


def now():
    # Same clock/timezone as the schema's NOW()-based status view.
    return query('SELECT NOW(6) AS now', one=True)['now']


def buyer(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        uid = session.get('user_id')
        if not uid:
            fail(401, 'AUTH_REQUIRED', 'Please log in.')
        user = query('SELECT u.user_id,u.username FROM users u JOIN buyers b ON b.user_id=u.user_id WHERE u.user_id=%s', (uid,), one=True)
        if not user:
            fail(403, 'BUYER_REQUIRED', 'A buyer account is required.')
        g.user = user
        return fn(*args, **kwargs)
    return wrapped


def seller_record(seller_id):
    seller = query('''SELECT s.user_id AS seller_user_id,u.username,
        CASE WHEN r.user_id IS NOT NULL THEN 'restaurant' ELSE 'grocery' END AS kind,
        r.cuisine_type,gs.store_category,r.active_status,v.rating
        FROM sellers s JOIN users u ON u.user_id=s.user_id
        LEFT JOIN restaurants r ON r.user_id=s.user_id
        LEFT JOIN grocery_stores gs ON gs.user_id=s.user_id
        LEFT JOIN seller_rating_view v ON v.user_id=s.user_id
        WHERE s.user_id=%s''', (seller_id,), one=True)
    if not seller:
        fail(404, 'NOT_FOUND', 'Seller not found.')
    seller['rating'] = float(seller['rating']) if seller['rating'] is not None else None
    return seller


def active_seller(seller_id):
    seller = seller_record(seller_id)
    if seller['kind'] == 'restaurant' and seller['active_status'] != 'Active':
        fail(409, 'SELLER_INACTIVE', 'This restaurant is not accepting new orders.')


def group_record(order_id, lock=False):
    integer(order_id)
    record = query('''SELECT o.*,go.deadline,u.username AS seller_name
        FROM orders o JOIN group_orders go ON go.order_id=o.order_id
        JOIN users u ON u.user_id=o.seller_user_id WHERE o.order_id=%s''' + (' FOR UPDATE' if lock else ''), (order_id,), one=True)
    if not record:
        fail(404, 'NOT_FOUND', 'Group order not found.')
    return record


def editable(record):
    if record['order_status'] != 'Pending':
        fail(409, 'ORDER_NOT_EDITABLE', 'This order is no longer editable.')
    if now() >= record['deadline']:
        fail(409, 'GROUP_LOCKED', 'The deadline has passed. This group is locked.')


def member(order_id):
    if not query('SELECT 1 FROM group_order_participants WHERE order_id=%s AND buyer_user_id=%s', (order_id, g.user['user_id']), one=True):
        fail(403, 'NOT_A_MEMBER', 'Join this group first.')


def group_detail(order_id):
    record = group_record(order_id)
    clock = now()
    members = query('''SELECT p.buyer_user_id,u.username FROM group_order_participants p
        JOIN users u ON u.user_id=p.buyer_user_id WHERE p.order_id=%s ORDER BY p.buyer_user_id''', (order_id,))
    uid = g.user['user_id']
    is_member = any(m['buyer_user_id'] == uid for m in members)
    is_host = uid == record['host_user_id']
    open_order = record['order_status'] == 'Pending' and clock < record['deadline']
    preview = {key: record[key] for key in ['order_id', 'host_user_id', 'seller_user_id', 'seller_name', 'order_status']}
    preview.update(deadline=stamp(record['deadline']), server_time=stamp(clock),
                   group_status='open' if clock < record['deadline'] else 'locked',
                   member_count=len(members), can_join=open_order and not is_member)
    if not is_member:
        return preview
    delivery = query('SELECT shipping_fee FROM deliveries WHERE order_id=%s', (order_id,), one=True)
    if record['fulfillment_type'] == 'Delivery' and not delivery:
        fail(500, 'INTERNAL_ERROR', 'Delivery data is missing for this order.')
    fee = cents(delivery['shipping_fee']) if record['fulfillment_type'] == 'Delivery' else 0
    lines = query('''SELECT i.order_id,i.user_id,i.item_id,m.item_name,i.quantity,i.unit_price_snapshot
        FROM order_items i JOIN menu_items m ON m.item_id=i.item_id
        WHERE i.order_id=%s ORDER BY i.user_id,i.item_id''', (order_id,))
    for line in lines:
        line['unit_price_snapshot_cents'] = cents(line.pop('unit_price_snapshot'))
        line['line_total_cents'] = line['quantity'] * line['unit_price_snapshot_cents']
    base, remainder = divmod(fee, len(members))
    for m in members:
        m['is_host'] = m['buyer_user_id'] == record['host_user_id']
        m['item_subtotal_cents'] = sum(i['line_total_cents'] for i in lines if i['user_id'] == m['buyer_user_id'])
        m['shipping_share_cents'] = base + (remainder if m['is_host'] else 0)
        m['total_cents'] = m['item_subtotal_cents'] + m['shipping_share_cents']
    preview.update(created_at=stamp(record['created_at']),
                   fulfillment_type=record['fulfillment_type'], coupon_id=record['coupon_id'],
                   currency='HKD', coupon_applied=False, summary_basis='before_coupons',
                   shipping_fee_cents=fee, can_edit=open_order,
                   can_leave=open_order and not is_host, can_cancel=open_order and is_host,
                   members=members, items=lines)
    preview.update(timing_fields(record))
    preview['can_place'] = is_host and record['order_status'] == 'Pending' and bool(lines)
    return preview


def individual_detail(order_id):
    integer(order_id)
    record = query('''SELECT o.*,u.username AS seller_name FROM orders o
        JOIN solo_orders so ON so.order_id=o.order_id
        JOIN users u ON u.user_id=o.seller_user_id
        WHERE o.order_id=%s AND o.host_user_id=%s''', (order_id, g.user['user_id']), one=True)
    if not record:
        fail(404, 'NOT_FOUND', 'Order not found.')
    delivery = query('SELECT shipping_fee FROM deliveries WHERE order_id=%s', (order_id,), one=True)
    if record['fulfillment_type'] == 'Delivery' and not delivery:
        fail(500, 'INTERNAL_ERROR', 'Delivery information is missing.')
    lines = query('''SELECT i.item_id,m.item_name,i.quantity,i.unit_price_snapshot
        FROM order_items i JOIN menu_items m ON m.item_id=i.item_id
        WHERE i.order_id=%s ORDER BY i.item_id''', (order_id,))
    for line in lines:
        line['unit_price_snapshot_cents'] = cents(line.pop('unit_price_snapshot'))
        line['line_total_cents'] = line['quantity'] * line['unit_price_snapshot_cents']
    timestamp = record['created_at']
    record.update(created_at=stamp(timestamp), order_type='individual', currency='HKD',
        items=lines, item_subtotal_cents=sum(i['line_total_cents'] for i in lines),
        shipping_fee_cents=cents(delivery['shipping_fee']) if record['fulfillment_type']=='Delivery' else 0,
        coupon_applied=False, summary_basis='before_coupons', can_edit=record['order_status']=='Pending', can_cancel=record['order_status']=='Pending')
    record['total_cents'] = record['item_subtotal_cents'] + record['shipping_fee_cents']
    record.update(timing_fields(record))
    record['can_place'] = record['can_edit'] and bool(lines)
    return record


def timing_fields(record):
    return {key: stamp(record[key]) if record.get(key) else None
            for key in ('placed_at','completion_due_at','completed_at')}


def create_delivery(order_id, fulfillment_type):
    if fulfillment_type == 'Delivery':
        try:
            fee, courier = int(current_app.config['DELIVERY_FEE_CENTS']), int(current_app.config['DEMO_COURIER_USER_ID'])
            if not 0 <= fee <= 9999999999 or courier <= 0:
                raise ValueError()
        except (TypeError, ValueError):
            fail(503, 'DELIVERY_NOT_CONFIGURED', 'Delivery settings are not configured.')
        if not query("SELECT user_id FROM couriers WHERE user_id=%s AND availability_status='Available'", (courier,), one=True):
            fail(503, 'DELIVERY_NOT_CONFIGURED', 'An available demo courier must be configured.')
        execute("INSERT INTO deliveries(order_id,courier_user_id,delivery_status,shipping_fee) VALUES(%s,%s,'Assigned',%s)", (order_id, courier, Decimal(fee) / 100))


def update_order_item(record, item_id, quantity):
    order_id = record['order_id']
    if quantity is None:
        execute('DELETE FROM order_items WHERE order_id=%s AND user_id=%s AND item_id=%s', (order_id, g.user['user_id'], item_id))
    else:
        # Lock catalog row so availability/price cannot change during this addition.
        item = query('SELECT * FROM menu_items WHERE item_id=%s FOR UPDATE', (item_id,), one=True)
        if not item:
            fail(404, 'NOT_FOUND', 'Menu item not found.')
        if item['seller_user_id'] != record['seller_user_id']:
            fail(409, 'WRONG_SELLER', 'Choose an item from this order’s store.')
        existing = query('SELECT quantity FROM order_items WHERE order_id=%s AND user_id=%s AND item_id=%s', (order_id, g.user['user_id'], item_id), one=True)
        if not existing:
            active_seller(record['seller_user_id'])
        if item['availability_status'] != 'Available' and (not existing or quantity > existing['quantity']):
            fail(409, 'ITEM_UNAVAILABLE', 'This item is unavailable. Existing quantities may only be reduced.')
        execute('''INSERT INTO order_items(order_id,user_id,item_id,quantity,unit_price_snapshot)
            VALUES(%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)''',
                (order_id, g.user['user_id'], item_id, quantity, item['price']))


def solo_record(order_id, lock=False):
    integer(order_id)
    record = query('''SELECT o.* FROM orders o JOIN solo_orders so ON so.order_id=o.order_id
        WHERE o.order_id=%s AND o.host_user_id=%s''' + (' FOR UPDATE' if lock else ''), (order_id,g.user['user_id']), one=True)
    if not record:
        fail(404, 'NOT_FOUND', 'Order not found.')
    return record


def editable_individual(record):
    if record['order_status'] != 'Pending':
        fail(409, 'ORDER_NOT_EDITABLE', 'This order is already placed or cancelled.')


def create_app(config=None):
    load_dotenv(ROOT / '.env')
    app = Flask(__name__, static_folder=None)
    app.config.update({key: os.environ.get(key, default) for key, default in {
        'MYSQL_HOST': '127.0.0.1', 'MYSQL_PORT': '3306', 'MYSQL_USER': 'root',
        'MYSQL_PASSWORD': '', 'MYSQL_DATABASE': 'group_eats',
        'COMPLETION_POLL_SECONDS': '5', 'DELIVERY_FEE_CENTS': '1000', 'DEMO_COURIER_USER_ID': '90201',
    }.items()})
    app.config.update(SECRET_KEY=os.environ.get('SECRET_KEY') or secrets.token_hex(32),
                      SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax',
                      MAX_CONTENT_LENGTH=16384)
    if config:
        app.config.update(config)
    app.teardown_appcontext(close_db)

    @app.before_request
    def csrf_check():
        if request.path.startswith(PREFIX) and request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            expected, received = session.get('csrf_token'), request.headers.get('X-CSRF-Token', '')
            if not expected or not hmac.compare_digest(expected, received):
                fail(403, 'CSRF_INVALID', 'Refresh the page and try again.')

    @app.after_request
    def headers(response):
        if request.path.startswith(PREFIX):
            response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.errorhandler(APIError)
    def api_error(error):
        return jsonify(error={'code': error.code, 'message': error.message}), error.status

    @app.errorhandler(pymysql.MySQLError)
    def database_error(error):
        app.logger.exception('Database request failed')
        if getattr(error, 'args', [None])[0] in (1205, 1213):
            return jsonify(error={'code': 'CONCURRENT_UPDATE', 'message': 'Another update is in progress. Refresh and try again.'}), 409
        return jsonify(error={'code': 'INTERNAL_ERROR', 'message': 'Database operation failed. Check server configuration.'}), 500

    @app.errorhandler(HTTPException)
    def http_error(error):
        if request.path.startswith(PREFIX):
            return jsonify(error={'code': 'NOT_FOUND' if error.code == 404 else 'VALIDATION_ERROR', 'message': error.description}), error.code
        return error

    @app.get(PREFIX + '/auth/session')
    def get_session():
        if 'csrf_token' not in session:
            session['csrf_token'] = secrets.token_hex(32)
        user = None
        if session.get('user_id'):
            user = query('SELECT u.user_id,u.username FROM users u JOIN buyers b ON b.user_id=u.user_id WHERE u.user_id=%s', (session['user_id'],), one=True)
            if user:
                user['role'] = 'buyer'
        return jsonify(data={'user': user, 'csrf_token': session['csrf_token']})

    @app.post(PREFIX + '/auth/login')
    def login():
        data = body(('email', 'password'))
        if not isinstance(data['email'], str) or not isinstance(data['password'], str) or len(data['email']) > 254 or len(data['password']) > 256:
            fail(400, 'VALIDATION_ERROR', 'Invalid email or password format.')
        user = query('''SELECT u.user_id,u.username,u.password_hash FROM users u
            JOIN buyers b ON b.user_id=u.user_id WHERE u.email=%s''', (data['email'].strip(),), one=True)
        valid = False
        if user:
            try:
                valid = check_password_hash(user['password_hash'], data['password'])
            except ValueError:
                pass
        if not valid:
            fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
        session.clear()
        session.update(user_id=user['user_id'], csrf_token=secrets.token_hex(32))
        return jsonify(data={'user': {'user_id': user['user_id'], 'username': user['username'], 'role': 'buyer'}, 'csrf_token': session['csrf_token']})

    @app.post(PREFIX + '/auth/logout')
    def logout():
        body()
        session.clear()
        return '', 204

    @app.get(PREFIX + '/sellers')
    def sellers():
        kind = request.args.get('kind')
        search = request.args.get('q', '').strip()
        if kind not in (None, 'restaurant', 'grocery') or len(search) > 150:
            fail(400, 'VALIDATION_ERROR', 'Invalid seller filters.')
        rows = query('SELECT user_id FROM sellers ORDER BY user_id')
        result = [seller_record(row['user_id']) for row in rows]
        result = [s for s in result if (not kind or s['kind'] == kind) and (not search or search.casefold() in ' '.join(str(s.get(k) or '') for k in ('username', 'cuisine_type', 'store_category')).casefold())]
        return jsonify(data=result)

    @app.get(PREFIX + '/sellers/<int:seller_id>')
    def seller(seller_id):
        integer(seller_id)
        return jsonify(data=seller_record(seller_id))

    @app.get(PREFIX + '/sellers/<int:seller_id>/items')
    def items(seller_id):
        integer(seller_id)
        seller_record(seller_id)
        rows = query('SELECT item_id,seller_user_id,item_name,price,availability_status FROM menu_items WHERE seller_user_id=%s ORDER BY item_id', (seller_id,))
        for row in rows:
            row['price_cents'] = cents(row.pop('price'))
        return jsonify(data=rows)

    @app.get(PREFIX + '/group-orders')
    @buyer
    def groups():
        scope = request.args.get('scope', 'joinable')
        if scope not in ('joinable', 'mine'):
            fail(400, 'VALIDATION_ERROR', 'Invalid scope.')
        rows = query('''SELECT o.order_id, EXISTS(SELECT 1 FROM group_order_participants p
            WHERE p.order_id=o.order_id AND p.buyer_user_id=%s) AS is_member
            FROM orders o JOIN group_orders go ON go.order_id=o.order_id ORDER BY o.order_id DESC''', (g.user['user_id'],))
        result = []
        for row in rows:
            if (scope == 'mine') != bool(row['is_member']):
                continue
            detail = group_detail(row['order_id'])
            if scope == 'joinable' and not detail['can_join']:
                continue
            entry = {k: detail[k] for k in ('order_id', 'seller_user_id', 'seller_name', 'host_user_id', 'deadline', 'group_status', 'order_status', 'member_count', 'server_time', 'can_join')}
            entry.update(is_member=bool(row['is_member']), is_host=detail['host_user_id'] == g.user['user_id'])
            result.append(entry)
        return jsonify(data={'server_time': stamp(now()), 'orders': result})

    @app.get(PREFIX + '/orders')
    @buyer
    def my_orders():
        order_type = request.args.get('type', 'all')
        if order_type not in ('all', 'group', 'individual'):
            fail(400, 'VALIDATION_ERROR', 'Invalid order type.')
        rows = query('''SELECT o.order_id,o.host_user_id,o.seller_user_id,
            u.username AS seller_name,o.created_at,o.order_status,o.fulfillment_type,o.placed_at,o.completion_due_at,o.completed_at,
            CASE WHEN go.order_id IS NOT NULL THEN 'group' ELSE 'individual' END AS order_type,
            go.deadline,
            (SELECT COUNT(*) FROM group_order_participants gp WHERE gp.order_id=o.order_id) AS member_count
            FROM orders o JOIN users u ON u.user_id=o.seller_user_id
            LEFT JOIN group_orders go ON go.order_id=o.order_id
            LEFT JOIN solo_orders so ON so.order_id=o.order_id
            LEFT JOIN group_order_participants p ON p.order_id=go.order_id AND p.buyer_user_id=%s
            WHERE (go.order_id IS NOT NULL AND p.buyer_user_id IS NOT NULL)
               OR (so.order_id IS NOT NULL AND go.order_id IS NULL AND o.host_user_id=%s)
            ORDER BY o.order_id DESC''', (g.user['user_id'], g.user['user_id']))
        clock = now()
        result = []
        for row in rows:
            if order_type != 'all' and row['order_type'] != order_type:
                continue
            row.update(timing_fields(row))
            row['created_at'] = stamp(row['created_at'])
            row['group_status'] = ('open' if clock < row['deadline'] else 'locked') if row['deadline'] else None
            row['deadline'] = stamp(row['deadline']) if row['deadline'] else None
            row['is_host'] = row['host_user_id'] == g.user['user_id']
            result.append(row)
        return jsonify(data={'server_time': stamp(clock), 'orders': result})

    @app.get(PREFIX + '/orders/<int:order_id>')
    @buyer
    def order_detail(order_id):
        integer(order_id)
        if query('SELECT order_id FROM group_orders WHERE order_id=%s', (order_id,), one=True):
            member(order_id)
            detail = group_detail(order_id)
            detail['order_type'] = 'group'
            return jsonify(data=detail)
        return jsonify(data=individual_detail(order_id))

    @app.post(PREFIX + '/orders')
    @buyer
    def create_individual():
        data = body(('seller_user_id','fulfillment_type'))
        seller_id = integer(data['seller_user_id'])
        if data['fulfillment_type'] not in ('Delivery','Self-Pickup'):
            fail(400, 'VALIDATION_ERROR', 'Invalid fulfillment type.')
        with transaction():
            active_seller(seller_id)
            order_id = execute("INSERT INTO orders(host_user_id,seller_user_id,order_status,fulfillment_type) VALUES(%s,%s,'Pending',%s)", (g.user['user_id'],seller_id,data['fulfillment_type']))
            execute('INSERT INTO solo_orders(order_id) VALUES(%s)', (order_id,))
            create_delivery(order_id,data['fulfillment_type'])
        return jsonify(data=individual_detail(order_id)),201

    @app.route(PREFIX + '/orders/<int:order_id>/items/<int:item_id>',methods=['PUT','DELETE'])
    @buyer
    def individual_line(order_id,item_id):
        integer(item_id)
        quantity = integer(body(('quantity',))['quantity'],99) if request.method=='PUT' else None
        if request.method=='DELETE' and request.content_length:
            body()
        with transaction():
            record=solo_record(order_id,lock=True)
            editable_individual(record)
            update_order_item(record,item_id,quantity)
        return (jsonify(data=individual_detail(order_id)) if quantity is not None else ('',204))

    @app.post(PREFIX + '/orders/<int:order_id>/place')
    @buyer
    def place_individual(order_id):
        body()
        with transaction():
            record=solo_record(order_id,lock=True)
            if record['order_status']!='Confirmed':
                editable_individual(record)
                lines=query('SELECT user_id FROM order_items WHERE order_id=%s',(order_id,))
                if not lines:
                    fail(409,'EMPTY_ORDER','Add food before placing your order.')
                if any(i['user_id']!=g.user['user_id'] for i in lines):
                    fail(409,'INVALID_ORDER','Order items need to be corrected before submission.')
                if record['fulfillment_type']=='Delivery' and not query('SELECT delivery_id FROM deliveries WHERE order_id=%s',(order_id,),one=True):
                    fail(409,'INVALID_ORDER','Delivery information is missing.')
                execute("UPDATE orders SET order_status='Confirmed' WHERE order_id=%s",(order_id,))
            schedule_completion(order_id)
        return jsonify(data=individual_detail(order_id))

    @app.post(PREFIX + '/orders/<int:order_id>/cancel')
    @buyer
    def cancel_individual(order_id):
        body()
        with transaction():
            record=solo_record(order_id,lock=True)
            if record['order_status']!='Cancelled':
                editable_individual(record)
                execute("UPDATE orders SET order_status='Cancelled' WHERE order_id=%s",(order_id,))
        return jsonify(data=individual_detail(order_id))

    @app.post(PREFIX + '/group-orders')
    @buyer
    def create_group():
        data = body(('seller_user_id', 'deadline', 'fulfillment_type'))
        seller_id = integer(data['seller_user_id'])
        try:
            # Python 3.10 does not accept the Z suffix emitted by JS toISOString.
            raw = data['deadline']
            if not isinstance(raw, str):
                raise ValueError()
            deadline = datetime.fromisoformat(raw.removesuffix('Z') + ('+00:00' if raw.endswith('Z') else ''))
            if deadline.tzinfo is None:
                raise ValueError()
            deadline = deadline.astimezone(HK).replace(tzinfo=None, microsecond=0)
        except (ValueError, TypeError, OverflowError):
            fail(400, 'VALIDATION_ERROR', 'Use a timestamp with an explicit timezone.')
        if data['fulfillment_type'] not in ('Delivery', 'Self-Pickup'):
            fail(400, 'VALIDATION_ERROR', 'Invalid fulfillment type.')
        with transaction():
            active_seller(seller_id)
            if deadline <= now():
                fail(400, 'VALIDATION_ERROR', 'Deadline must be in the future.')
            order_id = execute('''INSERT INTO orders(host_user_id,seller_user_id,order_status,fulfillment_type)
                VALUES(%s,%s,'Pending',%s)''', (g.user['user_id'], seller_id, data['fulfillment_type']))
            execute('INSERT INTO group_orders(order_id,deadline) VALUES(%s,%s)', (order_id, deadline))
            execute('INSERT INTO group_order_participants(order_id,buyer_user_id) VALUES(%s,%s)', (order_id, g.user['user_id']))
            create_delivery(order_id, data['fulfillment_type'])
        return jsonify(data=group_detail(order_id)), 201

    @app.get(PREFIX + '/group-orders/<int:order_id>')
    @buyer
    def detail(order_id):
        return jsonify(data=group_detail(order_id))

    @app.route(PREFIX + '/group-orders/<int:order_id>/members/me', methods=['PUT', 'DELETE'])
    @buyer
    def membership(order_id):
        if request.method == 'PUT' or request.content_length:
            body()
        with transaction():
            record = group_record(order_id, lock=True)
            editable(record)
            if request.method == 'PUT':
                execute('INSERT INTO group_order_participants(order_id,buyer_user_id) VALUES(%s,%s) ON DUPLICATE KEY UPDATE buyer_user_id=VALUES(buyer_user_id)', (order_id, g.user['user_id']))
            else:
                member(order_id)
                if record['host_user_id'] == g.user['user_id']:
                    fail(403, 'HOST_CANNOT_LEAVE', 'The host must cancel instead of leaving.')
                execute('DELETE FROM order_items WHERE order_id=%s AND user_id=%s', (order_id, g.user['user_id']))
                execute('DELETE FROM group_order_participants WHERE order_id=%s AND buyer_user_id=%s', (order_id, g.user['user_id']))
        return (jsonify(data=group_detail(order_id)) if request.method == 'PUT' else ('', 204))

    @app.route(PREFIX + '/group-orders/<int:order_id>/items/<int:item_id>', methods=['PUT', 'DELETE'])
    @buyer
    def line(order_id, item_id):
        integer(item_id)
        quantity = integer(body(('quantity',))['quantity'], 99) if request.method == 'PUT' else None
        if request.method == 'DELETE' and request.content_length:
            body()
        with transaction():
            record = group_record(order_id, lock=True)
            member(order_id)
            editable(record)
            update_order_item(record, item_id, quantity)
        return (jsonify(data=group_detail(order_id)) if quantity is not None else ('', 204))

    @app.post(PREFIX + '/group-orders/<int:order_id>/place')
    @buyer
    def place(order_id):
        body()
        with transaction():
            record = group_record(order_id, lock=True)
            if record['host_user_id'] != g.user['user_id']:
                fail(403, 'HOST_ONLY', 'Only the host can place this group order.')
            # Repeated submissions must not create duplicate orders/deliveries.
            if record['order_status'] != 'Confirmed':
                if record['order_status'] != 'Pending':
                    fail(409, 'ORDER_NOT_EDITABLE', 'This order cannot be placed.')
                lines = query('SELECT user_id,item_id,quantity FROM order_items WHERE order_id=%s', (order_id,))
                if not lines:
                    fail(409, 'EMPTY_ORDER', 'Add food before placing an order.')
                participants = query('SELECT buyer_user_id FROM group_order_participants WHERE order_id=%s', (order_id,))
                ids = {p['buyer_user_id'] for p in participants}
                if record['host_user_id'] not in ids or any(i['user_id'] not in ids for i in lines):
                    fail(409, 'INVALID_ORDER', 'Order membership needs to be corrected before submission.')
                if record['fulfillment_type'] == 'Delivery' and not query('SELECT delivery_id FROM deliveries WHERE order_id=%s', (order_id,), one=True):
                    fail(409, 'INVALID_ORDER', 'Delivery information is missing.')
                execute("UPDATE orders SET order_status='Confirmed' WHERE order_id=%s", (order_id,))
            schedule_completion(order_id)
        return jsonify(data=group_detail(order_id))

    @app.post(PREFIX + '/group-orders/<int:order_id>/cancel')
    @buyer
    def cancel(order_id):
        body()
        with transaction():
            record = group_record(order_id, lock=True)
            if record['host_user_id'] != g.user['user_id']:
                fail(403, 'HOST_ONLY', 'Only the host can cancel this group.')
            if record['order_status'] != 'Cancelled':
                editable(record)
                execute("UPDATE orders SET order_status='Cancelled' WHERE order_id=%s", (order_id,))
        return jsonify(data=group_detail(order_id))

    @app.get('/')
    def index():
        return send_from_directory(ROOT / 'frontend', 'index.html')

    @app.get('/<path:filename>')
    def assets(filename):
        if filename.startswith('api/'):
            fail(404, 'NOT_FOUND', 'Endpoint not found.')
        return send_from_directory(ROOT / 'frontend', filename)

    return app
