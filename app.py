import os
from backend.app import create_app
from backend.completion import start_completion_worker

app = create_app()

if __name__ == '__main__':
    reload_enabled = os.environ.get('APP_RELOAD', '1') == '1'
    worker = None
    # With the reloader enabled, only the serving child owns a worker.
    if not reload_enabled or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        worker = start_completion_worker(app.config)
    try:
        app.run(host='127.0.0.1', port=int(os.environ.get('PORT', '5000')),
                debug=False, use_reloader=reload_enabled)
    finally:
        if worker:
            worker[0].set()
            worker[1].join(timeout=6)
