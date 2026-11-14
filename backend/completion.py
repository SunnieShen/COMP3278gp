"""Durable local-demo completion schedule; no real payment or dispatch."""
import logging
import random
import threading
from .db import connect, execute


def schedule_completion(order_id):
    # Called inside the placement transaction. A retry keeps the original ETA.
    delay = random.SystemRandom().randint(15 * 60, 60 * 60)
    execute('''UPDATE orders SET placed_at=COALESCE(placed_at,NOW()),
        completion_due_at=COALESCE(completion_due_at,TIMESTAMPADD(SECOND,%s,NOW()))
        WHERE order_id=%s AND order_status='Confirmed' ''', (delay, order_id))


def complete_due_orders(config):
    """One transaction; lock parents first, consistent with all order writes."""
    connection = connect(config)
    try:
        with connection.cursor() as cursor:
            cursor.execute('''SELECT order_id FROM orders
                WHERE order_status='Confirmed' AND completion_due_at<=NOW()
                ORDER BY order_id LIMIT 100 FOR UPDATE SKIP LOCKED''')
            ids = [row['order_id'] for row in cursor.fetchall()]
            if ids:
                marks = ','.join(['%s'] * len(ids))
                cursor.execute(f'''UPDATE deliveries SET delivery_status='Delivered',delivery_timestamp=NOW()
                    WHERE order_id IN ({marks})''', ids)
                cursor.execute(f'''UPDATE orders SET order_status='Completed',completed_at=NOW()
                    WHERE order_id IN ({marks}) AND order_status='Confirmed' ''', ids)
        connection.commit()
        return len(ids)
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def start_completion_worker(config):
    stop = threading.Event()
    interval = max(1, int(config.get('COMPLETION_POLL_SECONDS', 5)))

    def work():
        while not stop.is_set():
            try:
                complete_due_orders(config)
            except Exception:
                logging.getLogger(__name__).exception('Completion check failed; will retry next tick')
            stop.wait(interval)

    thread = threading.Thread(target=work, name='order-completion', daemon=True)
    thread.start()
    return stop, thread


if __name__ == '__main__':
    from .app import create_app
    app = create_app()
    event, thread = start_completion_worker(app.config)
    print('Completion worker running; Ctrl+C to stop.')
    try:
        while thread.is_alive():
            thread.join(timeout=1)
    except KeyboardInterrupt:
        event.set()
        thread.join(timeout=6)
