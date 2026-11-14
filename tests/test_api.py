"""Integration tests against a new, isolated MySQL database (never the app DB)."""
import secrets
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor

import pymysql
from pymysql.constants import CLIENT
from backend.app import create_app
from backend.manage import import_sql, prepare_demo_accounts, migrate_created_at, DEMO_PASSWORD
from backend.completion import complete_due_orders


class APIIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.name = 'group_eats_test_' + secrets.token_hex(6)
        config = create_app().config
        cls.connection = pymysql.connect(host=config['MYSQL_HOST'], port=int(config['MYSQL_PORT']),
            user=config['MYSQL_USER'], password=config['MYSQL_PASSWORD'], autocommit=True,
            client_flag=CLIENT.MULTI_STATEMENTS, cursorclass=pymysql.cursors.DictCursor,
            init_command="SET time_zone = '+08:00'")
        with cls.connection.cursor() as c:
            c.execute(f'CREATE DATABASE `{cls.name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
            c.execute(f'USE `{cls.name}`')
        import_sql(cls.connection, 'db/schema.sql')
        cls.app = create_app({'TESTING':True, 'SECRET_KEY':'test-only-secret', 'MYSQL_DATABASE':cls.name,
                              'DELIVERY_FEE_CENTS':'1000', 'DEMO_COURIER_USER_ID':'90201'})

    @classmethod
    def tearDownClass(cls):
        with cls.connection.cursor() as c:
            c.execute(f'DROP DATABASE `{cls.name}`')
        cls.connection.close()

    def setUp(self):
        # Only our randomly named disposable database is cleared.
        with self.connection.cursor() as c:
            c.execute('SET FOREIGN_KEY_CHECKS=0')
            c.execute('SHOW FULL TABLES')
            tables = [next(v for k,v in r.items() if k != 'Table_type') for r in c.fetchall() if r['Table_type']=='BASE TABLE']
            for table in tables:
                c.execute(f'TRUNCATE TABLE `{table}`')
            c.execute('SET FOREIGN_KEY_CHECKS=1')
        import_sql(self.connection, 'db/seed.sql')
        prepare_demo_accounts(self.connection)
        self.a, self.ta = self.login('alice')
        self.b, self.tb = self.login('bob')

    def login(self, name):
        client = self.app.test_client()
        token = client.get('/api/v1/auth/session').json['data']['csrf_token']
        response = client.post('/api/v1/auth/login', json={'email':f'{name}@example.com','password':DEMO_PASSWORD}, headers={'X-CSRF-Token':token})
        self.assertEqual(response.status_code,200,response.json)
        return client,response.json['data']['csrf_token']

    def write(self, client, token, path, method='POST', data=None):
        return client.open('/api/v1'+path,method=method,json={} if data is None else data,headers={'X-CSRF-Token':token})

    def test_creation_timestamp_migration_preserves_existing_orders(self):
        with self.connection.cursor() as cursor:
            cursor.execute('SELECT order_id,created_at FROM orders ORDER BY order_id')
            before = cursor.fetchall()
            cursor.execute('ALTER TABLE orders RENAME COLUMN created_at TO order_timestamp')
        migrate_created_at(self.connection)
        migrate_created_at(self.connection)
        with self.connection.cursor() as cursor:
            cursor.execute('SELECT order_id,created_at FROM orders ORDER BY order_id')
            self.assertEqual(cursor.fetchall(), before)
        response = self.a.get('/api/v1/orders?type=all')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json['data']['orders'])
        for order in response.json['data']['orders']:
            self.assertIn('created_at', order)
            self.assertNotIn('order_timestamp', order)
            detail = self.a.get(f"/api/v1/orders/{order['order_id']}")
            self.assertEqual(detail.status_code, 200)
            self.assertEqual(detail.json['data']['created_at'], order['created_at'])
            self.assertNotIn('order_timestamp', detail.json['data'])

    def create(self, fee='1000', fulfillment='Delivery'):
        self.app.config['DELIVERY_FEE_CENTS'] = fee
        self.app.config['DEMO_COURIER_USER_ID'] = '90201'
        deadline = (datetime.now(timezone(timedelta(hours=8)))+timedelta(hours=1)).isoformat()
        response = self.write(self.a,self.ta,'/group-orders',data={'seller_user_id':90101,'deadline':deadline,'fulfillment_type':fulfillment})
        self.assertEqual(response.status_code,201,response.json)
        return response.json['data']['order_id']

    def sql(self, sql, params=()):
        with self.connection.cursor() as c:
            c.execute(sql,params)
            return list(c.fetchall())

    def test_schema_and_all_fixtures(self):
        rows=self.sql('SHOW FULL TABLES')
        self.assertEqual(sum(r['Table_type']=='BASE TABLE' for r in rows),18)
        self.assertEqual(sum(r['Table_type']=='VIEW' for r in rows),2)
        total=0
        for row in rows:
            if row['Table_type']=='BASE TABLE':
                name=next(v for k,v in row.items() if k!='Table_type')
                total+=self.sql(f'SELECT COUNT(*) AS n FROM `{name}`')[0]['n']
        self.assertEqual(total,160)

    def test_auth_csrf_and_no_password_leak(self):
        anon=self.app.test_client()
        self.assertEqual(anon.get('/api/v1/group-orders').status_code,401)
        self.assertEqual(anon.post('/api/v1/auth/login',json={}).status_code,403)
        t=anon.get('/api/v1/auth/session').json['data']['csrf_token']
        bad=self.write(anon,t,'/auth/login',data={'email':'alice@example.com','password':'wrong'})
        self.assertEqual(bad.status_code,401)
        session=self.a.get('/api/v1/auth/session').json['data']
        self.assertNotIn('password_hash',str(session))
        self.assertEqual(self.write(self.a,self.ta,'/auth/logout').status_code,204)
        self.assertEqual(self.a.get('/api/v1/group-orders').status_code,401)

    def test_catalog_and_null_empty_cases(self):
        stores=self.a.get('/api/v1/sellers').json['data']
        self.assertEqual(len(stores),4)
        inactive=next(s for s in stores if s['seller_user_id']==90104)
        self.assertIsNone(inactive['rating'])
        self.assertEqual(self.a.get('/api/v1/sellers/90104/items').json['data'],[])
        self.assertEqual(len(self.a.get('/api/v1/sellers?kind=grocery').json['data']),1)
        self.assertEqual(self.a.get('/api/v1/sellers/90101/items').json['data'][0]['price_cents'],6800)
        self.assertEqual(self.a.get('/api/v1/sellers?kind=invalid').status_code,400)

    def test_real_crud_and_price_snapshot(self):
        oid=self.create();path=f'/group-orders/{oid}/items/92001'
        added=self.write(self.a,self.ta,path,'PUT',{'quantity':1})
        self.assertEqual(added.status_code,200,added.json)
        self.sql('UPDATE menu_items SET price=99.00 WHERE item_id=92001')
        changed=self.write(self.a,self.ta,path,'PUT',{'quantity':2})
        line=changed.json['data']['items'][0]
        self.assertEqual(line['line_total_cents'],13600)
        record=self.sql('SELECT quantity,unit_price_snapshot FROM order_items WHERE order_id=%s',(oid,))[0]
        self.assertEqual(record,{'quantity':2,'unit_price_snapshot':Decimal('68.00')})
        self.assertEqual(self.write(self.a,self.ta,path,'DELETE').status_code,204)
        self.assertEqual(self.write(self.a,self.ta,path,'DELETE').status_code,204)
        self.assertEqual(self.sql('SELECT * FROM order_items WHERE order_id=%s',(oid,)),[])

    def test_membership_and_own_items(self):
        oid=self.create();base=f'/group-orders/{oid}'
        preview=self.b.get('/api/v1'+base).json['data'];self.assertNotIn('items',preview)
        denied=self.write(self.b,self.tb,base+'/items/92001','PUT',{'quantity':1});self.assertEqual(denied.status_code,403)
        for _ in range(2):self.assertEqual(self.write(self.b,self.tb,base+'/members/me','PUT').status_code,200)
        self.write(self.a,self.ta,base+'/items/92001','PUT',{'quantity':1})
        self.write(self.b,self.tb,base+'/items/92001','PUT',{'quantity':2})
        self.assertEqual(len(self.sql('SELECT * FROM order_items WHERE order_id=%s',(oid,))),2)
        self.assertEqual(self.write(self.b,self.tb,base+'/cancel').status_code,403)
        self.assertEqual(self.write(self.a,self.ta,base+'/members/me','DELETE').status_code,403)
        self.assertEqual(self.write(self.b,self.tb,base+'/members/me','DELETE').status_code,204)
        rows=self.sql('SELECT user_id FROM order_items WHERE order_id=%s',(oid,));self.assertEqual(rows,[{'user_id':90001}])

    def test_rounding_zero_pickup_and_coupon_label(self):
        # Read sample 94102 as Bob, who is its host.
        g=self.b.get('/api/v1/group-orders/94102').json['data']
        self.assertEqual([m['shipping_share_cents'] for m in g['members']],[334,333,333])
        self.assertEqual(sum(m['total_cents'] for m in g['members']),16800)
        # Test-only session for the seeded four-person group's host, Emma.
        emma=self.app.test_client()
        with emma.session_transaction() as session:
            session['user_id']=90005
        four=emma.get('/api/v1/group-orders/94103').json['data']
        self.assertEqual([m['shipping_share_cents'] for m in four['members']],[252,250,250,250])
        # Alice joins sample 94103, then leave to check recalculation.
        self.write(self.a,self.ta,'/group-orders/94103/members/me','PUT')
        g=self.a.get('/api/v1/group-orders/94103').json['data']
        self.assertEqual(sum(m['shipping_share_cents'] for m in g['members']),1002)
        for fulfillment in ('Delivery','Self-Pickup'):
            oid=self.create('0',fulfillment)
            g=self.a.get(f'/api/v1/group-orders/{oid}').json['data']
            self.assertEqual(g['shipping_fee_cents'],0)
            self.assertEqual(len(self.sql('SELECT * FROM deliveries WHERE order_id=%s',(oid,))),int(fulfillment=='Delivery'))
        g=self.a.get('/api/v1/group-orders/94002').json['data']
        self.assertFalse(g['coupon_applied']);self.assertEqual(g['summary_basis'],'before_coupons')

    def test_expiry_and_cancel(self):
        oid=self.create();base=f'/group-orders/{oid}'
        self.sql('UPDATE group_orders SET deadline=NOW()-INTERVAL 1 SECOND WHERE order_id=%s',(oid,))
        for client,token,path,method in [(self.a,self.ta,base+'/items/92001','PUT'),(self.b,self.tb,base+'/members/me','PUT'),(self.a,self.ta,base+'/cancel','POST')]:
            response=self.write(client,token,path,method,{'quantity':1} if '/items/' in path else {})
            self.assertEqual(response.status_code,409,response.json)
        self.assertEqual(self.a.get('/api/v1'+base).json['data']['group_status'],'locked')
        oid=self.create();base=f'/group-orders/{oid}'
        self.assertEqual(self.write(self.a,self.ta,base+'/cancel').status_code,200)
        self.assertEqual(self.write(self.a,self.ta,base+'/cancel').status_code,200)
        self.assertEqual(self.write(self.b,self.tb,base+'/members/me','PUT').status_code,409)
        self.assertEqual(self.sql('SELECT order_status FROM orders WHERE order_id=%s',(oid,))[0]['order_status'],'Cancelled')

    def test_validation_and_unavailable_items(self):
        oid=self.create();base=f'/group-orders/{oid}'
        for quantity in [0,-1,1.5,True,'2',100]:
            self.assertEqual(self.write(self.a,self.ta,base+'/items/92001','PUT',{'quantity':quantity}).status_code,400)
        self.assertEqual(self.write(self.a,self.ta,base+'/items/92003','PUT',{'quantity':1}).status_code,409)
        self.assertEqual(self.write(self.a,self.ta,base+'/items/92001','PUT',{'quantity':2,'user_id':90002}).status_code,400)
        self.assertEqual(self.write(self.a,self.ta,base+'/items/92001','DELETE',{'user_id':90002}).status_code,400)
        self.write(self.a,self.ta,base+'/items/92001','PUT',{'quantity':2})
        self.sql("UPDATE menu_items SET availability_status='Unavailable' WHERE item_id=92001")
        self.assertEqual(self.write(self.a,self.ta,base+'/items/92001','PUT',{'quantity':3}).status_code,409)
        self.assertEqual(self.write(self.a,self.ta,base+'/items/92001','PUT',{'quantity':1}).status_code,200)

    def test_bad_delivery_config_rolls_back_all_tables(self):
        self.app.config['DEMO_COURIER_USER_ID']='999999'
        count=self.sql('SELECT COUNT(*) AS n FROM orders')[0]['n']
        response=self.write(self.a,self.ta,'/group-orders',data={'seller_user_id':90101,'deadline':'2099-12-31T23:59:59+08:00','fulfillment_type':'Delivery'})
        self.assertEqual(response.status_code,503,response.json)
        self.assertEqual(self.sql('SELECT COUNT(*) AS n FROM orders')[0]['n'],count)
        self.app.config['DEMO_COURIER_USER_ID']='90201'

    def test_timezone_and_lifecycle(self):
        invalid=self.write(self.a,self.ta,'/group-orders',data={'seller_user_id':90101,'deadline':'2099-12-31T12:00:00','fulfillment_type':'Self-Pickup'})
        self.assertEqual(invalid.status_code,400)
        response=self.write(self.a,self.ta,'/group-orders',data={'seller_user_id':90101,'deadline':'2099-12-31T00:00:00Z','fulfillment_type':'Self-Pickup'})
        self.assertEqual(response.json['data']['deadline'],'2099-12-31T08:00:00+08:00')
        self.sql("UPDATE orders SET order_status='Completed' WHERE order_id=94002")
        g=self.a.get('/api/v1/group-orders/94002').json['data']
        self.assertEqual(g['group_status'],'open');self.assertFalse(g['can_edit'])
        self.assertEqual(self.write(self.a,self.ta,'/group-orders/94002/items/92001','PUT',{'quantity':2}).status_code,409)

    def test_concurrent_join_is_unique(self):
        oid=self.create()
        def join(_):
            c,t=self.login('bob')
            return self.write(c,t,f'/group-orders/{oid}/members/me','PUT').status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(list(pool.map(join,range(2))),[200,200])
        self.assertEqual(len(self.sql('SELECT * FROM group_order_participants WHERE order_id=%s',(oid,))),2)

    def test_place_before_or_after_deadline_only_host_and_idempotent(self):
        oid=self.create();path=f'/group-orders/{oid}'
        self.write(self.a,self.ta,path+'/items/92001','PUT',{'quantity':2})
        early=self.write(self.a,self.ta,path+'/place')
        self.assertEqual(early.status_code,200,early.json)
        self.assertEqual(early.json['data']['order_status'],'Confirmed')
        self.assertEqual(early.json['data']['group_status'],'open')
        self.assertFalse(early.json['data']['can_edit'])
        self.assertEqual(self.write(self.b,self.tb,path+'/members/me','PUT').status_code,409)
        self.assertEqual(self.write(self.a,self.ta,path+'/items/92001','PUT',{'quantity':3}).status_code,409)
        oid=self.create();path=f'/group-orders/{oid}'
        self.write(self.a,self.ta,path+'/items/92001','PUT',{'quantity':2})
        self.sql('UPDATE group_orders SET deadline=NOW()-INTERVAL 1 SECOND WHERE order_id=%s',(oid,))
        self.assertEqual(self.write(self.b,self.tb,path+'/place').status_code,403)
        before=self.a.get('/api/v1'+path).json['data']
        self.assertTrue(before['can_place'])
        for _ in range(2):
            placed=self.write(self.a,self.ta,path+'/place')
            self.assertEqual(placed.status_code,200,placed.json)
            self.assertEqual(placed.json['data']['order_status'],'Confirmed')
            self.assertFalse(placed.json['data']['can_place'])
        self.assertEqual(self.sql('SELECT order_status FROM orders WHERE order_id=%s',(oid,))[0]['order_status'],'Confirmed')
        self.assertEqual(len(self.sql('SELECT * FROM deliveries WHERE order_id=%s',(oid,))),1)
        self.assertEqual(self.write(self.a,self.ta,path+'/items/92001','PUT',{'quantity':3}).status_code,409)

    def test_empty_and_cancelled_orders_cannot_be_placed(self):
        oid=self.create();path=f'/group-orders/{oid}'
        self.sql('UPDATE group_orders SET deadline=NOW()-INTERVAL 1 SECOND WHERE order_id=%s',(oid,))
        response=self.write(self.a,self.ta,path+'/place')
        self.assertEqual(response.json['error']['code'],'EMPTY_ORDER')
        oid=self.create();path=f'/group-orders/{oid}'
        self.write(self.a,self.ta,path+'/cancel')
        self.assertEqual(self.write(self.a,self.ta,path+'/place').status_code,409)

    def test_orders_categories_and_private_individual_receipt(self):
        self.assertEqual(self.app.test_client().get('/api/v1/orders').status_code,401)
        self.assertEqual(self.a.get('/api/v1/orders?type=bad').status_code,400)
        self.assertEqual(self.a.get('/api/v1/orders?type=individual').json['data']['orders'],[])
        groups=self.a.get('/api/v1/orders?type=group').json['data']['orders']
        self.assertTrue(groups)
        self.assertTrue(all(o['order_type']=='group' for o in groups))
        carol=self.app.test_client()
        with carol.session_transaction() as session:
            session['user_id']=90003
        orders=carol.get('/api/v1/orders?type=individual').json['data']['orders']
        self.assertEqual([o['order_id'] for o in orders],[94001])
        receipt=carol.get('/api/v1/orders/94001').json['data']
        self.assertEqual(receipt['order_type'],'individual')
        self.assertEqual(receipt['item_subtotal_cents'],5800)
        self.assertEqual(receipt['shipping_fee_cents'],0)
        self.assertEqual(receipt['total_cents'],5800)
        self.assertFalse(receipt['can_edit'])
        self.assertEqual(self.a.get('/api/v1/orders/94001').status_code,404)
        self.assertEqual(self.a.get('/api/v1/orders/94102').status_code,403)
        self.assertEqual(self.a.get('/api/v1/orders/94002').json['data']['order_type'],'group')

    def test_individual_create_crud_place_and_ownership(self):
        response=self.write(self.a,self.ta,'/orders',data={'seller_user_id':90101,'fulfillment_type':'Delivery'})
        self.assertEqual(response.status_code,201,response.json)
        oid=response.json['data']['order_id'];path=f'/orders/{oid}'
        self.assertEqual(self.sql('SELECT COUNT(*) AS n FROM group_orders WHERE order_id=%s',(oid,))[0]['n'],0)
        self.assertFalse(response.json['data']['can_place'])
        self.assertEqual(self.write(self.a,self.ta,path+'/place').status_code,409)
        self.assertEqual(self.write(self.b,self.tb,path+'/items/92001','PUT',{'quantity':1}).status_code,404)
        self.assertEqual(self.write(self.a,self.ta,path+'/items/92003','PUT',{'quantity':1}).status_code,409)
        added=self.write(self.a,self.ta,path+'/items/92001','PUT',{'quantity':1})
        self.assertEqual(added.status_code,200,added.json)
        self.sql('UPDATE menu_items SET price=99.00 WHERE item_id=92001')
        changed=self.write(self.a,self.ta,path+'/items/92001','PUT',{'quantity':2})
        self.assertEqual(changed.json['data']['item_subtotal_cents'],13600)
        self.write(self.a,self.ta,path+'/items/92002','PUT',{'quantity':1})
        self.assertEqual(self.write(self.a,self.ta,path+'/items/92002','DELETE').status_code,204)
        for _ in range(2):
            placed=self.write(self.a,self.ta,path+'/place')
            self.assertEqual(placed.status_code,200,placed.json)
            self.assertEqual(placed.json['data']['order_status'],'Confirmed')
            self.assertEqual(placed.json['data']['total_cents'],14600)
        self.assertEqual(self.write(self.a,self.ta,path+'/items/92001','PUT',{'quantity':3}).status_code,409)
        self.assertEqual(self.write(self.a,self.ta,path+'/cancel').status_code,409)
        self.assertEqual(self.write(self.b,self.tb,path+'/place').status_code,404)
        self.assertEqual(self.a.get('/api/v1/orders?type=individual').json['data']['orders'][0]['order_id'],oid)
        self.assertEqual(self.b.get('/api/v1/orders?type=individual').json['data']['orders'],[])
        self.assertEqual(len(self.sql('SELECT * FROM deliveries WHERE order_id=%s',(oid,))),1)

    def test_individual_pickup_cancel_and_delivery_rollback(self):
        response=self.write(self.a,self.ta,'/orders',data={'seller_user_id':90101,'fulfillment_type':'Self-Pickup'})
        oid=response.json['data']['order_id'];path=f'/orders/{oid}'
        self.assertEqual(response.json['data']['shipping_fee_cents'],0)
        self.assertEqual(self.sql('SELECT * FROM deliveries WHERE order_id=%s',(oid,)),[])
        self.assertEqual(self.write(self.a,self.ta,path+'/cancel').status_code,200)
        self.assertEqual(self.write(self.a,self.ta,path+'/cancel').status_code,200)
        self.assertEqual(self.write(self.a,self.ta,path+'/place').status_code,409)
        count=self.sql('SELECT COUNT(*) AS n FROM orders')[0]['n']
        self.app.config['DEMO_COURIER_USER_ID']='99999'
        response=self.write(self.a,self.ta,'/orders',data={'seller_user_id':90101,'fulfillment_type':'Delivery'})
        self.assertEqual(response.status_code,503,response.json)
        self.assertEqual(self.sql('SELECT COUNT(*) AS n FROM orders')[0]['n'],count)
        self.app.config['DEMO_COURIER_USER_ID']='90201'

    def test_completion_schedule_is_persistent_and_within_15_60_minutes(self):
        oid=self.create();path=f'/group-orders/{oid}'
        self.write(self.a,self.ta,path+'/items/92001','PUT',{'quantity':1})
        placed=self.write(self.a,self.ta,path+'/place').json['data']
        start=datetime.fromisoformat(placed['placed_at'])
        due=datetime.fromisoformat(placed['completion_due_at'])
        self.assertTrue(900 <= (due-start).total_seconds() <= 3600)
        retry=self.write(self.a,self.ta,path+'/place').json['data']
        self.assertEqual(retry['completion_due_at'],placed['completion_due_at'])
        self.assertEqual(complete_due_orders(self.app.config),0)
        self.sql('UPDATE orders SET completion_due_at=NOW()-INTERVAL 1 SECOND WHERE order_id=%s',(oid,))
        self.assertEqual(complete_due_orders(self.app.config),1)
        finished=self.a.get('/api/v1'+path).json['data']
        self.assertEqual(finished['order_status'],'Completed')
        self.assertIsNotNone(finished['completed_at'])
        self.assertFalse(finished['can_place'])
        self.assertFalse(finished['can_edit'])
        self.assertEqual(self.sql('SELECT delivery_status FROM deliveries WHERE order_id=%s',(oid,))[0]['delivery_status'],'Delivered')
        self.assertEqual(complete_due_orders(self.app.config),0)
        self.assertEqual(self.write(self.a,self.ta,path+'/place').status_code,409)

    def test_completion_for_pickup_and_no_changes_to_cancelled_or_unscheduled(self):
        response=self.write(self.a,self.ta,'/orders',data={'seller_user_id':90101,'fulfillment_type':'Self-Pickup'})
        oid=response.json['data']['order_id'];path=f'/orders/{oid}'
        self.write(self.a,self.ta,path+'/items/92001','PUT',{'quantity':1})
        placed=self.write(self.a,self.ta,path+'/place').json['data']
        self.assertIsNotNone(placed['completion_due_at'])
        self.sql('UPDATE orders SET completion_due_at=NOW()-INTERVAL 1 SECOND WHERE order_id=%s',(oid,))
        self.sql("UPDATE orders SET completion_due_at=NOW()-INTERVAL 1 SECOND WHERE order_id=94007")
        self.assertEqual(complete_due_orders(self.app.config),1)
        self.assertEqual(self.a.get('/api/v1'+path).json['data']['order_status'],'Completed')
        self.assertEqual(self.sql('SELECT * FROM deliveries WHERE order_id=%s',(oid,)),[])
        self.assertEqual(self.sql('SELECT order_status FROM orders WHERE order_id=94007')[0]['order_status'],'Cancelled')
        self.assertEqual(self.sql('SELECT order_status FROM orders WHERE order_id=94104')[0]['order_status'],'Confirmed')


if __name__=='__main__':
    unittest.main()
