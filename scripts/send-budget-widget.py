"""Send the standalone demo to the explicitly configured or identifiable test chat."""
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request
import zlib


def main():
    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not token:
        sys.exit('Set TELEGRAM_BOT_TOKEN outside the repository.')
    html = (Path(__file__).resolve().parent.parent / 'widgets/budget-demo.html').read_text()
    raw = html.encode('utf-8')
    packed = len(zlib.compress(raw, 9))
    if len(raw) > 32768 or packed > 4096:
        sys.exit('Widget exceeds the Telegram size limit.')
    base = 'https://api.telegram.org/beta/bot' + token + '/'

    def api(method, params):
        request = urllib.request.Request(base + method, data=json.dumps(params).encode(),
                                         headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                data = json.load(response)
        except urllib.error.HTTPError as error:
            try:
                description = json.load(error).get('description', 'Request rejected')
            except (ValueError, KeyError):
                description = 'Request rejected'
            sys.exit(method + ': ' + description.replace(token, '[redacted]'))
        except (OSError, urllib.error.URLError):
            sys.exit(method + ': network failure; outcome unknown, inspect chat before retrying.')
        if not data.get('ok'):
            sys.exit(method + ': request failed')
        return data['result']

    chat = os.environ.get('TELEGRAM_WIDGET_CHAT_ID')
    if chat:
        chat = int(chat)
    else:
        # No offset: discovery must not acknowledge/discard another pending update.
        chats = set()
        wait = max(0, min(300, int(os.environ.get('TELEGRAM_WIDGET_WAIT_SECONDS', '0'))))
        deadline = time.monotonic() + wait
        while True:
            updates = api('getUpdates', {'timeout': min(10, wait), 'limit': 100})
            for update in updates:
                message = update.get('message', {})
                if (message.get('chat', {}).get('type') == 'private'
                        and message.get('text', '').strip().lower() in ('/budget', 'бюджет')):
                    chats.add(message['chat']['id'])
                query = update.get('widget_query', {})
                if (query.get('data') == 'test:tap' and query.get('message_id') == 3
                        and query.get('chat', {}).get('type') == 'private'
                        and query['chat']['id'] == query.get('from', {}).get('id')):
                    chats.add(query['chat']['id'])
            if chats or time.monotonic() >= deadline:
                break
            time.sleep(1)
        if len(chats) != 1:
            sys.exit('Recipient not uniquely identified. Send /budget to the test bot or set TELEGRAM_WIDGET_CHAT_ID.')
        chat = chats.pop()
    if chat <= 0:
        sys.exit('This demo sender only supports a private test chat.')
    result = api('sendWidget', {
        'chat_id': chat, 'html': html, 'width': 0, 'height': 0,
        'caption': 'Мой бюджет · интерактивное демо. Доход и расход меняют только пример в этой карточке. Реальные данные не подключены.'
    })
    print(json.dumps({'sent': True, 'has_widget': bool(result.get('widget')),
                      'html_bytes': len(raw), 'zlib_bytes': packed}))


if __name__ == '__main__':
    main()
