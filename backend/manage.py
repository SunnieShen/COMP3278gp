"""Reproducible MySQL initialization. Run from root: python -m backend.manage init."""
import argparse
import re
import pymysql
from pymysql.constants import CLIENT
from werkzeug.security import generate_password_hash
from .app import create_app, ROOT

DEMO_PASSWORD = 'DemoPass3278!'


def import_sql(connection, filename):
    # Repository-owned SQL only; consume every result before the next statement.
    with connection.cursor() as cursor:
        cursor.execute((ROOT / filename).read_text())
        while cursor.nextset():
            pass


def prepare_demo_accounts(connection):
    with connection.cursor() as cursor:
        for uid in (90001, 90002):
            cursor.execute('UPDATE users SET password_hash=%s WHERE user_id=%s',
                           (generate_password_hash(DEMO_PASSWORD), uid))
    connection.commit()


def migrate_created_at(connection):
    """Rename the creation timestamp once, preserving all existing values."""
    with connection.cursor() as cursor:
        cursor.execute('SHOW COLUMNS FROM orders')
        names = {row['Field'] if isinstance(row, dict) else row[0] for row in cursor.fetchall()}
        if 'order_timestamp' in names and 'created_at' in names:
            raise RuntimeError('Both creation timestamp columns exist; resolve them before migrating.')
        if 'order_timestamp' in names:
            cursor.execute('ALTER TABLE orders RENAME COLUMN order_timestamp TO created_at')
        elif 'created_at' not in names:
            raise RuntimeError('No creation timestamp column found in orders.')
    connection.commit()


def migrate_completion(connection):
    # MySQL 8 does not offer portable ADD COLUMN IF NOT EXISTS.
    with connection.cursor() as cursor:
        cursor.execute('SHOW COLUMNS FROM orders')
        names={row['Field'] if isinstance(row,dict) else row[0] for row in cursor.fetchall()}
        for name in ('placed_at','completion_due_at','completed_at'):
            if name not in names:
                cursor.execute(f'ALTER TABLE orders ADD COLUMN {name} DATETIME NULL')
        cursor.execute("SHOW INDEX FROM orders WHERE Key_name='idx_order_completion'")
        if not cursor.fetchone():
            cursor.execute('ALTER TABLE orders ADD INDEX idx_order_completion(order_status,completion_due_at)')
    connection.commit()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['init', 'seed', 'demo-accounts', 'refresh-labels', 'migrate'])
    args = parser.parse_args()
    config = create_app().config
    name = config['MYSQL_DATABASE']
    if not re.fullmatch(r'[A-Za-z0-9_]+', name):
        raise SystemExit('MYSQL_DATABASE must contain only letters, numbers and underscores.')
    connection = pymysql.connect(host=config['MYSQL_HOST'], port=int(config['MYSQL_PORT']),
        user=config['MYSQL_USER'], password=config['MYSQL_PASSWORD'],
        charset='utf8mb4', autocommit=False, client_flag=CLIENT.MULTI_STATEMENTS,
        init_command="SET time_zone = '+08:00'")
    try:
        with connection.cursor() as cursor:
            if args.command == 'init':
                cursor.execute(f'CREATE DATABASE IF NOT EXISTS `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
            cursor.execute(f'USE `{name}`')
            if args.command == 'init':
                cursor.execute('SHOW TABLES')
                if cursor.fetchone():
                    raise SystemExit('Refusing init: target database is not empty. Choose a new MYSQL_DATABASE.')
        if args.command == 'migrate':
            migrate_created_at(connection)
            migrate_completion(connection)
        if args.command == 'init':
            import_sql(connection, 'db/schema.sql')
        if args.command in ('init', 'seed'):
            import_sql(connection, 'db/seed.sql')
        if args.command == 'refresh-labels':
            import_sql(connection, 'db/migrations/002_refresh_fixture_labels.sql')
        elif args.command != 'migrate':
            prepare_demo_accounts(connection)
        print(f'{args.command} completed for {name}.')
        if args.command == 'migrate':
            print('created_at and completion schedule columns are ready. Existing data/passwords preserved.')
        elif args.command == 'refresh-labels':
            print('Reserved display labels refreshed; existing passwords and orders preserved.')
        else:
            print('Demo buyers: alice@example.com and bob@example.com')
            print('Password: DemoPass3278! (local demo only)')
    finally:
        connection.close()


if __name__ == '__main__':
    main()
