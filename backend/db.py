"""One transactional MySQL connection per request; all values are bound parameters."""
from contextlib import contextmanager
import pymysql
from flask import current_app, g


def connect(config):
    return pymysql.connect(
        host=config['MYSQL_HOST'], port=int(config['MYSQL_PORT']),
        user=config['MYSQL_USER'], password=config['MYSQL_PASSWORD'],
        database=config['MYSQL_DATABASE'], charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor, autocommit=False,
        init_command="SET time_zone = '+08:00'", connect_timeout=5,
    )


def db():
    if 'db' not in g:
        g.db = connect(current_app.config)
    return g.db


def query(sql, args=(), one=False):
    with db().cursor() as cursor:
        cursor.execute(sql, args)
        return cursor.fetchone() if one else cursor.fetchall()


def execute(sql, args=()):
    with db().cursor() as cursor:
        cursor.execute(sql, args)
        return cursor.lastrowid


@contextmanager
def transaction():
    # End any read snapshot established by the authentication query before
    # acquiring the parent order lock. Otherwise REPEATABLE READ can see stale
    # membership/item rows after another transaction has committed.
    db().rollback()
    try:
        yield
        db().commit()
    except Exception:
        db().rollback()
        raise


def close_db(error=None):
    connection = g.pop('db', None)
    if connection:
        connection.rollback()
        connection.close()
