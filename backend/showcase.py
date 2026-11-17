"""Authenticated, read-only MySQL snapshots for the local live showcase."""
from datetime import datetime
from decimal import Decimal
from flask import Blueprint, Response, g, jsonify, send_from_directory
from .app import ROOT, PREFIX, buyer, group_record, member, seller_record, integer, now, stamp
from .db import query, transaction

blueprint = Blueprint('showcase', __name__)


def _value(value):
    if isinstance(value, datetime):
        return stamp(value)
    if isinstance(value, Decimal):
        return format(value, '.2f')
    return value


def _table(name, columns, sql, args):
    rows = query(sql, args)
    # Only validated numeric identifiers are substituted for display/download.
    # The executed query above always uses bound parameters.
    display_sql = sql
    for value in args:
        display_sql = display_sql.replace('%s', str(integer(value)), 1)
    return {'name': name, 'columns': columns, 'sql': display_sql + ';',
            'rows': [{k: _value(v) for k, v in row.items()} for row in rows]}


def _source():
    return {'engine': 'MySQL', 'database': query('SELECT DATABASE() AS name', one=True)['name'],
            'queried_at': stamp(now())}


def _group_snapshot(order_id):
    # One repeatable-read snapshot: tables cannot show half a committed change.
    with transaction():
        record = group_record(order_id)
        member(order_id)
        tables = [
            _table('orders', ['order_id','order_status','placed_at','completion_due_at','host_user_id','seller_user_id','coupon_id','fulfillment_type','created_at','completed_at'],
                '''SELECT order_id,order_status,placed_at,completion_due_at,host_user_id,
       seller_user_id,coupon_id,fulfillment_type,created_at,completed_at
FROM orders WHERE order_id=%s''', (order_id,)),
            _table('group_orders', ['order_id','deadline'],
                'SELECT order_id,deadline FROM group_orders WHERE order_id=%s', (order_id,)),
            _table('group_order_participants', ['order_id','buyer_user_id'],
                '''SELECT order_id,buyer_user_id FROM group_order_participants
WHERE order_id=%s ORDER BY buyer_user_id''', (order_id,)),
            _table('order_items', ['order_id','user_id','item_id','quantity','unit_price_snapshot'],
                '''SELECT order_id,user_id,item_id,quantity,unit_price_snapshot
FROM order_items WHERE order_id=%s ORDER BY user_id,item_id''', (order_id,)),
            _table('deliveries', ['delivery_id','order_id','courier_user_id','delivery_status','shipping_fee','delivery_timestamp'],
                '''SELECT delivery_id,order_id,courier_user_id,delivery_status,shipping_fee,delivery_timestamp
FROM deliveries WHERE order_id=%s''', (order_id,)),
        ]
        people = query('''SELECT u.user_id,u.username FROM users u
JOIN group_order_participants p ON p.buyer_user_id=u.user_id
WHERE p.order_id=%s ORDER BY u.user_id''', (order_id,))
        return {'source': _source(), 'order_id': order_id, 'seller_user_id': record['seller_user_id'],
                'people': people, 'tables': tables}


@blueprint.get('/showcase/live')
def live_page():
    return send_from_directory(ROOT / 'showcase', 'live.html')


@blueprint.get('/showcase/assets/<filename>')
def live_asset(filename):
    if filename not in ('live.js', 'live.css'):
        from .app import fail
        fail(404, 'NOT_FOUND', 'Asset not found.')
    return send_from_directory(ROOT / 'showcase', filename)


@blueprint.get(PREFIX + '/showcase/catalog/<int:seller_id>')
@buyer
def catalog(seller_id):
    integer(seller_id)
    with transaction():
        seller_record(seller_id)
        table = _table('menu_items', ['item_id','seller_user_id','item_name','price','availability_status'],
            '''SELECT item_id,seller_user_id,item_name,price,availability_status
FROM menu_items WHERE seller_user_id=%s ORDER BY item_id''', (seller_id,))
        snapshot = {'source': _source(), 'order_id': None, 'seller_user_id': seller_id,
                    'people': [], 'tables': [table]}
    return jsonify(data=snapshot)


@blueprint.get(PREFIX + '/showcase/session')
@buyer
def identity():
    # Observe identity without issuing a new CSRF token/cookie. The real
    # website in the iframe remains responsible for login and logout.
    return jsonify(data={'user': g.user})


@blueprint.get(PREFIX + '/showcase/group-orders/<int:order_id>')
@buyer
def snapshot(order_id):
    return jsonify(data=_group_snapshot(order_id))


@blueprint.get(PREFIX + '/showcase/group-orders/<int:order_id>/queries.sql')
@buyer
def worksheet(order_id):
    data = _group_snapshot(order_id)
    name = data['source']['database'].replace('`', '``')
    lines = [f'-- Read-only showcase queries for group {order_id}', f'USE `{name}`;', '']
    for table in data['tables']:
        lines += ['-- ' + table['name'], table['sql'], '']
    return Response('\n'.join(lines), mimetype='application/sql',
        headers={'Content-Disposition': f'attachment; filename="foodpanda-group-{order_id}.sql"'})
