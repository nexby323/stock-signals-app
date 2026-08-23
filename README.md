# Stock Signals App

A stock-tracking app that watches a user's chosen stocks, runs two independent 
machine learning models on each one daily, and sends a push notification when 
the models suggest a meaningful price move is coming.

## How it's structured

- **Mobile app** (React Native/Expo) — lets a user build a watchlist and receive 
  push notifications for their tracked stocks.
- **Backend** (Node.js + Express) — orchestrates the daily analysis job, talks to 
  the market data API and the ML microservice, and persists results via Prisma.
- **Database** (PostgreSQL via Supabase, accessed through Prisma) — stores users, 
  assets, predictions, and alerts.
- **ML microservice** (Python + Flask) — loads two trained models into memory and 
  returns pure predictions; it holds no business logic about what counts as an alert.

## The two prediction models

- **LSTM (long-term):** trained on ~180 days of daily OHLCV data per stock, predicts 
  next-session price and a directional trend. Confidence is estimated via Monte Carlo 
  Dropout (running inference 50 times with dropout active and measuring the spread).
- **FNN (short-term):** trained on 5-minute intraday data enriched with technical 
  indicators (SMA, RSI, MACD, Bollinger Bands), predicts short-term direction as a 
  probability. Also uses MC Dropout for its confidence score.

Both models run independently on every analysis; the backend then compares their 
outputs to decide whether - and what kind of - alert to raise.

## Alert logic

The backend evaluates six scenarios based on whether the two models agree, and how 
confident each one is (full thresholds in `SystemController.js`):

- Both models bullish, high confidence → strong trend alert
- Both models bearish, high confidence → strong trend alert
- Short-term bullish while long-term isn't → short-term spike alert
- Long-term bullish while short-term isn't → "buy the dip" alert
- Long-term confident alone → long-term breakout alert
- Large expected change but low confidence → volatility alert
- None of the above, but long-term confidence is still high → logged to the database 
  as a trend update, without sending a push notification (visible in-app via the 
  notification history)

**Known limitation:** this same six-scenario logic currently exists twice — once in 
`SystemController.js` (Node, decides what gets written to the database) and once in 
`mobile/src/factories/AlarmFactory.js` (decides what gets shown as a push notification 
on-device). They aren't derived from a single shared source, so a future threshold or 
message change needs to be applied in both places manually to stay in sync.

## Design patterns used

- **Singleton** — `MarketAPIClient` and the Prisma client, so the app maintains one 
  shared connection/rate-limited client rather than many.
- **Factory** — `AlarmFactory` on the mobile side builds the correct alert payload 
  shape based on which scenario matched.
- **Strategy-like separation** — the LSTM and FNN are interchangeable prediction 
  sources called through the same interface (`PythonModelClient.analyzeData`), 
  even though both currently run together rather than being swapped.

## Prerequisites

- Node.js (v18+), Python (3.10+)
- Docker & Docker Compose (runs both services together)
- A PostgreSQL database (this project uses Supabase)

## Setup

1. Clone the repo and copy `.env.example` to `.env`, filling in your own values 
   (`DATABASE_URL`, `DIRECT_URL`, `PYTHON_API_URL`, `JWT_SECRET`).
2. Run `docker compose up --build -d` to start both the Node backend and the Python 
   ML microservice.
3. Run `npx prisma migrate dev` to apply the schema to your database.
4. From `/mobile`, run `npm install` then `npm start` to launch the Expo client.

## Known gaps / things we'd improve with more time

- Alert decision logic is duplicated between backend and mobile (see above).
- `riskFactor` on `PredictionResult` is currently a placeholder value, not yet computed 
  from real model output.
- The stored `predictedDirection` only reflects the LSTM's direction, even in scenarios 
  where the FNN's signal was the one that actually triggered the alert.