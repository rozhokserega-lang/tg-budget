# Telegram budget card prototype

`budget-demo.html` is a self-contained widget for Telegram Widget profile 1.
It uses fictional amounts and local per-message storage. Income/expense buttons
open an amount selector; saving changes only this device's demo. Reset restores
the initial amounts. There are no network requests, bot queries, credentials or
real financial mutations, so the demo remains usable without a running bot.

Send with beta Bot API `sendWidget`, `html` containing this file, `height: 0`
(auto), `width: 0`, no `allow_queries` and no `is_shared`. Add a caption describing
the demo for clients that cannot render widget media. Check both uncompressed
32768-byte and zlib level-9 4096-byte limits before sending.

This is a visual/interaction prototype, not the production TG Budget integration.
The next stage needs a permanent bot handler, verified Telegram sender ownership,
existing backend operations and server-owned state. Never put personal financial
data in shared/public state. Forms needing keyboard input should open the Mini App.

## Sending

Use `python3 scripts/send-budget-widget.py` with `TELEGRAM_BOT_TOKEN` in the
process environment. Supply `TELEGRAM_WIDGET_CHAT_ID` for an explicit private
recipient, or send `/budget` to the test bot. Optional
`TELEGRAM_WIDGET_WAIT_SECONDS=180` waits for that command. The sender never logs
credentials or recipient IDs and refuses ambiguous recipients. No webhook is
configured and no permanent process is installed.

## Verification (2026-11-05)

- HTML: 6815 UTF-8 bytes, 2686 bytes zlib level 9; both Telegram limits passed.
- JavaScript syntax (`node --check`) and sender Python syntax (`ast.parse`) passed.
- Browser widths 320/360: no horizontal overflow; main/editor heights below 600px.
- Expense +500 changes balance 48350 -> 47850, expense36650 -> 37150 and chart.
- Income +1000 changes balance to48850; reload retains local state.
- Cancel leaves amounts unchanged; reset restores initial amounts.
- Real beta `sendWidget` accepted the HTML and returned widget media.
- User confirmed the delivered interactive card works in Telegram.

Browser preview validates ordinary DOM behavior; it is not a replacement for the
Telegram runtime. The delivered-widget user check covers that additional surface.
