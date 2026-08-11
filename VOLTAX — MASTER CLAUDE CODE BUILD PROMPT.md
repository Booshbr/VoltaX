VOLTAX — MASTER CLAUDE CODE BUILD PROMPT
ROLE
You are the lead software architect, senior full-stack engineer, quantitative trading-systems engineer, data engineer, UI/UX designer, security engineer, QA engineer, and DevOps engineer responsible for designing and building VoltaX.

VoltaX is a professional-grade but beginner-friendly trading analysis, market-ranking, backtesting, paper-trading, and optional real-trading platform focused on Deriv Synthetic Indices.

Your job is to build the actual application, not merely describe how it could be built.

You must work systematically, inspect the existing project before making assumptions, create production-quality code, test what you build, and keep the architecture extensible.

1. PRODUCT VISION
Build VoltaX, a trading intelligence platform that continuously analyzes Deriv synthetic indices and identifies statistically qualified trading opportunities.

VoltaX must:

Analyze all supported Deriv synthetic indices available through the user's API/data access.
Analyze multiple timeframes hierarchically.
Use one standardized methodology across the platform.
Use specialized analytical profiles for different synthetic-index families.
Keep different analytical modes distinct rather than mixing them into one vague signal.
Generate transparent, auditable signals.
Explain exactly why a signal was generated.
Rank markets by opportunity quality.
Continuously monitor active signals.
Store every signal.
Backtest the methodology.
Paper trade.
Support real trading through Deriv API, with strong safety controls.
Calculate position sizing.
Track historical performance.
Provide browser, Telegram, and in-app alerts.
Provide AI-generated explanations of algorithmic decisions.
Never present predictions as guaranteed profits.
Measure reliability statistically.
Be beginner-friendly while retaining advanced analytical depth.
Support dark and light themes.
Initially support only one authenticated user, while keeping the architecture multi-user ready.
Be designed so future features can be added without rewriting the core.
The product name is:

VOLTAX
2. IMPORTANT PRODUCT PRINCIPLES
These principles are mandatory.

Principle 1 — Algorithm first, AI second
The trading methodology must be deterministic/algorithmic and testable.

AI must NOT arbitrarily generate BUY/SELL signals.

AI is an explanation and research layer.

The core system decides:

market state
structure
setup
confirmation
entry
invalidation
risk
statistical score
AI explains those decisions in human-readable language.

Principle 2 — No guaranteed-profit language
Never claim:

guaranteed profits
guaranteed win rate
certainty
risk-free trades
"this will win"
Use language such as:

historical reliability
statistical confidence
historical expectancy
qualified setup
backtested performance
current setup quality
The platform should explicitly communicate that historical performance does not guarantee future results.

Principle 3 — Signals must be explainable
Every signal must contain structured reasons.

Example:

Signal: BUY
Index: Volatility 75
Mode: Precision Entry

Higher timeframe:
4H trend = bullish
1H structure = bullish
Structure break = confirmed

Setup:
15M demand zone = valid
15M displacement = confirmed

Entry:
5M confirmation = confirmed
1M precision trigger = confirmed

Risk:
Entry = ...
Stop = ...
TP1 = ...
TP2 = ...
Risk/Reward = 1:2.8

Statistical reliability:
74%

Reason:
Higher-timeframe bullish structure aligns with a confirmed
15M setup, followed by 5M confirmation and a valid 1M entry trigger.

The explanation must be generated from structured data rather than hallucinated.

3. TIMEFRAME ARCHITECTURE
Use the following hierarchy.

4H / 1H — MARKET STRUCTURE
Purpose:

trend
market regime
swing highs
swing lows
structure breaks
changes of character
major support/resistance
supply/demand zones
liquidity areas
volatility regime
directional bias
These timeframes establish context.

15M — SETUP
Purpose:

identify actionable setups
detect pullbacks
detect continuation structures
identify reversals where appropriate
identify relevant zones
detect displacement
detect rejection
assess setup quality
The 15M timeframe should NOT independently override higher-timeframe context without explicit methodology rules.

5M — ENTRY CONFIRMATION
Purpose:

confirm the 15M setup
detect local structure changes
identify confirmation candles
confirm momentum/displacement
refine entry
identify invalidation
1M — PRECISION ENTRY
Purpose:

optimize entry
minimize unnecessary stop distance
identify microstructure confirmation
refine risk/reward
avoid premature entry
1M should refine an already qualified setup rather than manufacture a trade from noise.

4. ANALYTICAL MODES
Do NOT mix these into one opaque signal.

Create distinct analytical modes.

MODE A — MARKET STRUCTURE
Timeframes:

4H
1H
Output:

MarketStructureAnalysis

Must contain:

trend
regime
structure state
swing points
BOS
CHOCH
liquidity
major zones
volatility condition
directional bias
invalidation level
confidence/reliability metrics
MODE B — SETUP
Timeframe:

15M
Output:

SetupAnalysis

Contains:

setup type
setup direction
setup zone
trigger conditions
invalidation
confluence
quality score
setup status
Possible states:

NONE
FORMING
QUALIFIED
INVALIDATED
TRIGGERED
EXPIRED

MODE C — ENTRY
Timeframe:

5M
Contains:

confirmation
local structure
momentum
entry area
invalidation
confirmation quality
MODE D — PRECISION ENTRY
Timeframe:

1M
Contains:

microstructure
precision trigger
refined entry
refined stop
entry quality
execution conditions
5. STANDARDIZED METHODOLOGY
Create one standardized methodology.

Do NOT build a random collection of indicators.

The methodology should follow:

MARKET CONTEXT
      ↓
HIGHER-TIMEFRAME STRUCTURE
      ↓
MARKET REGIME
      ↓
15M SETUP
      ↓
5M CONFIRMATION
      ↓
1M PRECISION ENTRY
      ↓
RISK VALIDATION
      ↓
STATISTICAL QUALIFICATION
      ↓
SIGNAL

The system should reject trades when mandatory conditions are not met.

Create explicit rules.

Avoid:

RSI says buy
MACD says buy
EMA says buy
therefore BUY

Instead create a structured decision engine.

6. ANALYTICAL COMPONENTS
Use all relevant analytical categories requested by the product requirements.

Where technically and statistically justified, implement:

Price structure
swing highs/lows
BOS
CHOCH
trend
ranges
consolidation
breakouts
failed breakouts
Liquidity
equal highs
equal lows
obvious liquidity pools
sweep detection
liquidity displacement
Zones
support
resistance
supply
demand
reaction zones
previous structure zones
Price action
rejection
engulfing behavior
displacement
momentum candles
compression
expansion
retests
Volatility
ATR
realized volatility
volatility regime
abnormal volatility
compression/expansion
Momentum
Use only where useful and statistically validated.

Possible components:

RSI
moving-average structure
momentum measurements
Do not allow indicators to dominate the structural methodology.

Volume
Only implement volume-derived features where reliable volume data exists for the relevant Deriv instrument.

Never invent volume data.

7. SYNTHETIC INDEX FAMILY PROFILES
Different Deriv synthetic index families must have specialized analytical profiles.

Create a profile system rather than hard-coding logic everywhere.

Example:

interface IndexFamilyProfile {
  family: IndexFamily;
  characteristics: string[];
  preferredFeatures: Feature[];
  excludedFeatures: Feature[];
  setupRules: SetupRule[];
  volatilityModel: VolatilityModel;
  scoringWeights: ScoringWeights;
}

Potential families may include instruments such as:

Volatility Indices
Boom Indices
Crash Indices
Jump Indices
Step Indices
Range Break Indices
Drift Switching Indices
other currently available Deriv synthetic families
IMPORTANT:

Do not assume these are the complete/current list.

The system must dynamically discover instruments from Deriv where possible.

Never hard-code a finite list if the API can provide the instrument universe.

8. DERIV API INTEGRATION
Build a dedicated Deriv integration layer.

Do not scatter API calls throughout the application.

Create something like:

src/
  integrations/
    deriv/
      client
      websocket
      auth
      instruments
      candles
      ticks
      contracts
      trading
      types

Responsibilities:

authentication
API connection
WebSocket lifecycle
reconnect handling
subscription management
instrument discovery
tick streaming
candle aggregation
historical data retrieval
account information
balance
contract information
order execution
trade status
error handling
The Deriv API token must NEVER be exposed to the browser.

Store credentials securely server-side.

Use environment variables/secrets.

Never commit credentials.

9. MARKET DATA ENGINE
Create a robust market-data subsystem.

Requirements:

historical candle ingestion
live tick ingestion
candle aggregation
timeframe generation
timestamp normalization
gap detection
duplicate detection
data validation
caching
persistence
The system should be able to derive:

1M
5M
15M
1H
4H

from reliable source data where appropriate.

Do not blindly aggregate if the source data semantics make aggregation inappropriate.

Build tests around candle construction.

10. DATABASE — SUPABASE
The user has a Supabase account but no existing project.

Design the application around Supabase.

Use:

PostgreSQL
Auth
Row Level Security
migrations
server-side access where appropriate
Create a proper relational schema.

At minimum include concepts equivalent to:

users
profiles
user_settings

instruments
instrument_families
instrument_metadata

market_data
candles

market_structure_analysis
setup_analysis
entry_analysis
precision_analysis

signals
signal_reasons
signal_events

risk_calculations

backtest_runs
backtest_trades
backtest_metrics

paper_trades
live_trades

performance_snapshots

alerts
alert_preferences
notification_events

strategy_versions
methodology_rules
scoring_weights

audit_logs
system_events

Do not unnecessarily duplicate large datasets.

Design indexes carefully.

Time-series queries must be efficient.

11. SIGNAL DATA MODEL
Create a versioned signal object.

Example conceptual structure:

interface Signal {
  id: string;

  instrumentId: string;
  instrumentFamily: string;

  direction: "LONG" | "SHORT";

  mode:
    | "STRUCTURE"
    | "SETUP"
    | "ENTRY"
    | "PRECISION";

  status:
    | "DEVELOPING"
    | "QUALIFIED"
    | "ACTIVE"
    | "TP1"
    | "TP2"
    | "STOPPED"
    | "EXPIRED"
    | "CANCELLED";

  entryPrice: number;
  stopLoss: number;

  takeProfits: {
    level: number;
    price: number;
  }[];

  riskReward: number;

  reliabilityScore: number;

  methodologyVersion: string;

  createdAt: Date;
  updatedAt: Date;

  reasons: SignalReason[];

  marketContext: MarketContext;

  setupContext: SetupContext;

  entryContext: EntryContext;

  riskContext: RiskContext;
}

Every generated signal must be immutable in its historical record.

If a signal changes state, record an event.

12. SIGNAL LIFECYCLE
Implement an explicit state machine.

Example:

SCANNING
   ↓
FORMING
   ↓
QUALIFIED
   ↓
ACTIVE
   ↓
TP1 / TP2 / COMPLETED

or

FORMING → INVALIDATED
QUALIFIED → EXPIRED
ACTIVE → STOPPED

Never silently overwrite signal history.

Record transitions.

13. SIGNAL RANKING / RADAR
Build a real-time market radar.

The radar should continuously evaluate all available instruments.

For each instrument calculate:

market structure quality
setup quality
entry quality
volatility condition
risk/reward
historical reliability
current market suitability
signal freshness
Then calculate a standardized ranking score.

Example:

Opportunity Score
=
Structure Quality
+ Setup Quality
+ Entry Quality
+ Statistical Reliability
+ Risk/Reward Quality
+ Market Condition Compatibility

Weights must be configurable and versioned.

Do not present the score as a probability of profit unless statistically calibrated.

14. STATISTICAL RELIABILITY
Reliability must be statistical.

Do not call a signal "reliable" merely because several indicators agree.

Track:

sample size
win rate
average win
average loss
expectancy
profit factor
Sharpe-like metrics where appropriate
maximum drawdown
average adverse excursion
average favorable excursion
streaks
performance by regime
performance by index
performance by family
performance by setup
performance by mode
Avoid overfitting.

Use out-of-sample validation.

Where possible:

Training period
Validation period
Test period

Keep methodology versions.

15. BACKTESTING ENGINE
Build a genuine event-driven backtesting engine.

It must:

replay historical candles
reproduce signal-generation logic
respect timeframe availability
prevent look-ahead bias
prevent future-data leakage
simulate entry
simulate stop loss
simulate take profit
calculate position size
calculate P/L
record trades
calculate statistics
Never use future candles when generating a historical signal.

This is critical.

Implement tests specifically designed to detect look-ahead bias.

16. HISTORICAL PATTERN COMPARISON
The user wants historical chart directions from past years compared with current conditions.

Implement this as a secondary research feature, not as an unquestioned prediction engine.

Possible architecture:

Current market state
       ↓
Feature representation
       ↓
Historical analog search
       ↓
Similar historical periods
       ↓
Subsequent historical outcomes
       ↓
Research statistics

Display:

similarity score
historical examples
what happened afterward
sample size
distribution of outcomes
Never say:

"This pattern guarantees the market will repeat."

Instead say:

"Historically similar conditions produced X outcomes across N observations."

17. PAPER TRADING
Implement a complete paper-trading environment.

Paper mode must behave as close as possible to live mode.

It should:

receive signals
calculate position size
simulate execution
track open trades
track P/L
apply stops
apply take profits
calculate equity
calculate drawdown
record trade history
Clearly distinguish:

PAPER
LIVE

throughout the UI.

18. REAL TRADING
Real trading must be opt-in.

Implement multiple safety layers.

Before allowing live execution:

confirm account
confirm connection
confirm trading mode
confirm risk configuration
verify token
verify instrument
verify contract
verify stake
verify limits
Include a prominent LIVE mode indicator.

Never automatically switch from paper to live.

Require explicit user action.

Create an emergency:

STOP ALL TRADING
control.

The system should support disabling new trades globally.

19. POSITION SIZING
Implement risk-based position sizing.

Use a conservative default risk model.

Include:

account balance
risk percentage
entry
stop distance
contract characteristics
minimum/maximum stake
exposure limits
Conceptually:

Risk Amount = Account Equity × Risk %

Position Size = Risk Amount / Effective Stop Distance

Adapt to Deriv's actual contract semantics.

Never assume conventional spot/CFD position sizing applies to every Deriv contract.

Validate against the actual API contract specifications.

20. RISK MANAGEMENT
Choose the safest reasonable default risk framework.

Recommended baseline:

conservative per-trade risk
maximum daily risk
maximum simultaneous exposure
consecutive-loss protection
maximum drawdown threshold
minimum risk/reward requirement
no revenge-trading logic
no automatic martingale
no uncontrolled position doubling
Do NOT implement martingale as a default strategy.

If any higher-risk feature is ever added, make it explicitly opt-in and clearly labeled.

21. DASHBOARD
Build a polished professional dashboard.

It must be beginner-friendly.

The user should understand the dashboard without needing to understand every technical concept.

Main navigation:

Dashboard
Radar
Signals
Markets
Charts
Backtesting
Paper Trading
Live Trading
Performance
History
Alerts
Settings

Potential additional:

Methodology
Risk Center
System Health
Data Quality
Audit Log

22. DASHBOARD HOME
The home dashboard should answer:

What is the market doing?
What are the best current opportunities?
Are any active signals running?
How has VoltaX performed?
Is the system healthy?
Display:

Market overview
Bullish markets
Bearish markets
Neutral markets
Developing setups
Top opportunities
Ranked signal cards.

Active signals
Live status.

Performance
total signals
win rate
expectancy
drawdown
paper/live performance
System health
Deriv connection
data feed
last market update
signal engine status
notification status
23. RADAR UI
Create a powerful but clean radar.

Columns:

Index
Family
Direction
Structure
Setup
Entry
Reliability
R:R
Opportunity Score
Status
Updated

Use visual ranking.

Filters:

family
direction
signal mode
reliability
R:R
status
volatility regime
Sorting:

strongest
newest
highest reliability
best R:R
highest opportunity score
24. SIGNAL DETAIL PAGE
Every signal gets a detailed page.

Show:

Signal
Direction
Index
Family
Status

4H Analysis
1H Analysis
15M Setup
5M Entry
1M Precision

Entry
Stop
TP1
TP2
R:R

Reliability
Sample Size
Historical Performance

Why VoltaX Generated This Signal

Signal Timeline

Price Chart

Related Historical Patterns

Risk Calculation

Backtest Context

The user must be able to understand exactly how the signal came to exist.

25. CHARTS
Charts must support:

candlesticks
multiple timeframes
structure annotations
zones
liquidity
entry
stop
take profits
signal markers
historical comparison
Allow:

1M
5M
15M
1H
4H

Switching timeframe must be fast.

26. PERFORMANCE DASHBOARD
Show:

Overall
total signals
win rate
loss rate
expectancy
profit factor
average R:R
maximum drawdown
Breakdown
By:

index
index family
setup type
direction
timeframe
market regime
methodology version
Visualizations
equity curve
drawdown curve
monthly performance
signal distribution
wins/losses
average trade
Make sure metrics are correctly defined and tested.

27. SIGNAL HISTORY
Every signal must be searchable.

Filters:

date
index
family
direction
mode
result
reliability
setup
methodology version
Each signal must remain auditable.

Store:

original conditions
original calculation
signal version
final result
28. ALERT SYSTEM
Implement a notification abstraction:

interface NotificationProvider {
  send(notification: Notification): Promise<void>;
}

Providers:

BrowserNotificationProvider
TelegramNotificationProvider
InAppNotificationProvider

Events may include:

new qualified signal
signal activated
TP reached
stop reached
signal invalidated
system disconnected
data feed failure
trading error
daily risk limit reached
Allow notification preferences.

29. TELEGRAM
Implement Telegram as an optional alert channel.

Create a clean provider abstraction.

Do not hard-code credentials.

Store:

TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID

as secure environment variables/secrets.

Messages should be concise.

Example:

VOLTAX SIGNAL

Volatility 75
BUY

Entry: ...
SL: ...
TP: ...

R:R: 1:2.7
Reliability: 74%

4H: Bullish
1H: Bullish
15M: Setup Confirmed
5M: Entry Confirmed
1M: Precision Confirmed

Reason:
...

30. BROWSER + IN-APP ALERTS
Use browser notifications where permission is granted.

Also maintain an in-app notification center.

Unread notification count.

Notification history.

Notification preferences.

31. AUTHENTICATION
Initially:

one user
But architect it properly.

Use Supabase Auth.

Support:

login
logout
password reset
session persistence
Use Row Level Security.

Never trust client-side authorization.

32. BEGINNER EXPERIENCE
The user selected:

BEGINNER
Therefore avoid overwhelming the interface.

Provide explanations such as:

What does "BOS" mean?

A Break of Structure means price moved beyond
a previous important swing point, suggesting that
the current market structure may be changing.

Use:

tooltips
info icons
simple descriptions
progressive disclosure
beginner explanations
advanced details behind expandable sections
Do not dumb down the underlying analytics.

33. AI EXPLANATION SYSTEM
Create an AI explanation service.

Input:

SignalExplanationContext

containing ONLY validated structured information.

Output:

SignalExplanation

including:

summary
structure explanation
setup explanation
entry explanation
risk explanation
reliability explanation
invalidation explanation
AI must never invent:

price levels
statistics
indicators
reasons
historical results
If data is unavailable, say so.

34. METHODOLOGY VERSIONING
Every signal must reference a methodology version.

Example:

VOLTAX-METHOD-1.0.0

When strategy logic changes:

1.0.0
1.1.0
2.0.0

Historical signals must remain associated with the methodology that created them.

This is essential for meaningful backtesting.

35. CONFIGURATION
Do not hard-code strategy parameters throughout the codebase.

Create configuration objects/tables.

Example:

StrategyConfig {
  version
  minimumReliability
  minimumRiskReward
  structureWeights
  setupWeights
  entryWeights
  precisionWeights
  volatilityRules
  riskRules
}

All important parameters must be versioned.

36. SYSTEM ARCHITECTURE
Prefer modular architecture.

Suggested structure:

voltax/
├── app/
│   ├── dashboard/
│   ├── radar/
│   ├── signals/
│   ├── markets/
│   ├── charts/
│   ├── backtesting/
│   ├── paper-trading/
│   ├── live-trading/
│   ├── performance/
│   ├── history/
│   ├── alerts/
│   ├── settings/
│   └── methodology/
│
├── components/
│
├── lib/
│   ├── analytics/
│   │   ├── structure/
│   │   ├── setup/
│   │   ├── entry/
│   │   ├── precision/
│   │   ├── liquidity/
│   │   ├── volatility/
│   │   └── scoring/
│   │
│   ├── trading/
│   │   ├── risk/
│   │   ├── position-sizing/
│   │   ├── paper/
│   │   └── live/
│   │
│   ├── backtesting/
│   ├── signals/
│   ├── market-data/
│   ├── notifications/
│   ├── ai/
│   ├── deriv/
│   ├── supabase/
│   └── utils/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── backtesting/
│   └── e2e/
│
├── supabase/
│   └── migrations/
│
├── scripts/
│
└── docs/

Adjust this structure if a better architecture is justified.

37. TECHNOLOGY PREFERENCES
Use modern, stable technologies.

Preferred baseline:

Next.js
TypeScript
React
Tailwind CSS
shadcn/ui or an equivalent high-quality component system
Supabase
PostgreSQL
WebSockets where appropriate
Zod for validation
a robust charting library
testing framework appropriate to the stack
Do not add unnecessary dependencies.

Before introducing a library, consider whether it materially improves the architecture.

38. CODE QUALITY
Use strict TypeScript.

Avoid:

any

unless genuinely unavoidable and documented.

Use:

clear interfaces
domain types
validation
error handling
logging
separation of concerns
dependency injection where useful
testable services
Avoid giant files.

Avoid giant functions.

Avoid hidden global state.

39. ERROR HANDLING
Every external dependency can fail.

Handle:

Deriv WebSocket disconnect
API rate limits
malformed market data
stale candles
missing data
Supabase failure
Telegram failure
AI provider failure
execution failure
authentication failure
The system should degrade safely.

If the data feed becomes stale:

DO NOT GENERATE NEW TRADING SIGNALS.
40. DATA QUALITY
Create a data-quality subsystem.

Detect:

stale feed
missing candles
duplicate candles
invalid timestamps
malformed prices
gaps
unexpected price jumps
incomplete timeframe aggregation
Expose data quality status in the UI.

Example:

DATA FEED
● Healthy
Last update: 1.2s ago

or:

DATA FEED
⚠ Delayed
Last update: 47s ago

New signals paused.

41. SECURITY
Mandatory:

never expose Deriv tokens client-side
never commit secrets
environment variables
server-side API calls
Supabase RLS
secure auth
input validation
rate limiting where appropriate
audit logging
safe webhook handling
CSRF protections where applicable
secure headers
sanitized errors
Never log secrets.

Never log complete API tokens.

42. LIVE TRADING SAFETY
Create multiple independent safeguards.

For example:

LIVE TRADING ENABLED
       ↓
Risk limits valid?
       ↓
Account connected?
       ↓
Instrument valid?
       ↓
Market data fresh?
       ↓
Signal still valid?
       ↓
Position limits valid?
       ↓
Execution approved

If any critical check fails:

NO TRADE

43. SYSTEM HEALTH
Create a System Health page.

Show:

Deriv connection
market-data connection
signal engine
database
notifications
Telegram
AI service
paper trading
live trading
Use clear states:

HEALTHY
DEGRADED
ERROR
DISCONNECTED
DISABLED

44. AUDIT LOGGING
Log important events:

authentication events
strategy changes
configuration changes
signal creation
signal invalidation
trade execution
execution failure
risk-limit activation
mode changes
live trading enabled/disabled
Never log sensitive secrets.

45. TESTING REQUIREMENTS
Testing is mandatory.

Write unit tests for:

swing detection
structure detection
BOS
CHOCH
zones
liquidity sweeps
volatility
setup qualification
entry confirmation
precision entry
scoring
risk calculations
position sizing
signal state machine
Write integration tests for:

Deriv data flow
database
signal persistence
notification system
paper trading
live-trading safety checks
Write backtesting tests specifically for:

look-ahead bias
future leakage
candle ordering
signal timing
stop/TP logic
position sizing
Write E2E tests for major user journeys.

46. DEVELOPMENT WORKFLOW
Do NOT attempt to write the entire project blindly in one pass.

Work in phases.

Before coding:

Inspect repository.
Inspect existing files.
Determine current state.
Identify missing infrastructure.
Create implementation plan.
Confirm assumptions through available documentation/tools where necessary.
Implement incrementally.
After each major phase:

Run type checking.
Run linting.
Run unit tests.
Run integration tests where applicable.
Fix failures.
Review architecture.
Update documentation.
Do not simply declare something complete because the code exists.

Verify it.

47. DOCUMENTATION
Create:

README.md
ARCHITECTURE.md
SETUP.md
DATABASE.md
TRADING_ENGINE.md
BACKTESTING.md
DERIV_INTEGRATION.md
SECURITY.md
DEPLOYMENT.md
METHODOLOGY.md

Documentation should explain how the system actually works.

48. ENVIRONMENT VARIABLES
Create:

.env.example

Never include real secrets.

Potential variables:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

DERIV_API_TOKEN=

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

AI_API_KEY=

NEXT_PUBLIC_APP_URL=

Only expose variables to the client when they are explicitly safe to expose.

49. UX DESIGN
Visual direction:

Dark theme
Professional trading terminal aesthetic.

Suggested palette:

dark graphite
deep navy
electric cyan
controlled green
controlled red
amber for warnings
Avoid excessive neon.

Light theme
Clean professional analytics dashboard.

Use accessible contrast.

Both themes must be polished.

50. RESPONSIVENESS
The application must work on:

desktop
laptop
tablet
mobile
Desktop should provide the richest experience.

Mobile should prioritize:

radar
active signals
alerts
signal details
performance
51. ACCESSIBILITY
Implement:

keyboard navigation
visible focus states
semantic HTML
accessible forms
sufficient color contrast
screen-reader-friendly labels
don't rely solely on color to communicate signal state
52. BEGINNER-FRIENDLY TERMINOLOGY
Where technical terminology is unavoidable, provide explanations.

Examples:

BOS
Break of Structure

CHOCH
Change of Character

R:R
Risk-to-Reward

Reliability
Historical statistical performance of similar qualified signals

Make explanations available through tooltips or expandable panels.

53. SIGNAL CARD
Create a high-quality reusable signal card.

Example:

┌─────────────────────────────────────┐
│ VOLATILITY 75                 BUY   │
│ Volatility Indices                  │
│                                     │
│ Reliability              74%        │
│ Opportunity              87/100      │
│ Risk / Reward            1 : 2.8     │
│                                     │
│ 4H     Bullish                      │
│ 1H     Bullish                      │
│ 15M    Qualified                    │
│ 5M     Confirmed                    │
│ 1M     Precision                    │
│                                     │
│ Entry       1234.50                 │
│ Stop        1228.20                 │
│ TP1         1247.10                 │
│ TP2         1252.40                 │
│                                     │
│ [View Analysis] [Paper Trade]       │
└─────────────────────────────────────┘

Numbers above are examples only.

Never fabricate live market values.

54. SIGNAL EXPLANATION UI
Use progressive disclosure.

Start with:

Why this signal?

Then:

1. Market Structure
2. Setup
3. Entry Confirmation
4. Precision Entry
5. Risk
6. Historical Reliability

Each section expands.

This is especially important for the beginner user.

55. MARKET PAGE
Each market gets:

live price
chart
structure
setup
entry
precision
current regime
volatility
historical statistics
signals
performance
backtest results
56. PAPER VS LIVE MODE
Make the distinction impossible to miss.

Example:

PAPER MODE

with blue styling.

And:

LIVE MODE

with strong warning styling.

Do not let users accidentally believe paper trades are real.

57. SETTINGS
Include:

Trading
default risk
maximum daily risk
minimum R:R
maximum open trades
paper/live mode
Signals
minimum reliability
alert threshold
selected index families
selected modes
Notifications
browser
Telegram
in-app
Appearance
dark
light
system
Account
profile
security
logout
58. PERFORMANCE OF THE APPLICATION
The system may process many instruments continuously.

Design for this.

Use:

caching
batching
efficient database queries
appropriate indexes
event-driven updates
WebSockets where useful
background workers/jobs where needed
debouncing/throttling
incremental calculations
Do not recompute everything from scratch every tick.

59. REAL-TIME ENGINE
Separate:

DATA INGESTION

from:

ANALYSIS

from:

SIGNAL GENERATION

from:

NOTIFICATION

from:

EXECUTION

Use clear boundaries.

Conceptually:

Tick
 ↓
Market Data
 ↓
Candle Update
 ↓
Feature Update
 ↓
Analysis
 ↓
Signal Decision
 ↓
Persistence
 ↓
Notification
 ↓
Optional Execution

60. NO SIGNAL IS A VALID RESULT
The system must be comfortable saying:

NO QUALIFIED SETUP

This is important.

Do not manufacture signals simply to keep the dashboard active.

A high-quality system may frequently say:

No trade.

That is acceptable.

61. SIGNAL THRESHOLDS
Use explicit qualification thresholds.

For example:

Structure must be valid
+
Setup must be valid
+
Entry confirmation must be valid
+
Risk must be acceptable
+
Data must be fresh
+
Statistical requirements must be satisfied
=
Qualified signal

Exact numeric thresholds should be configurable and empirically validated.

Do not invent arbitrary thresholds and call them statistically optimal.

62. BACKTEST / LIVE PARITY
The same strategy logic must power:

Backtesting
Paper Trading
Live Signal Generation

Avoid separate implementations that can drift apart.

Architecture:

Strategy Engine
      │
 ┌────┼─────┐
 ▼    ▼     ▼
Back  Paper Live
test  Trade Trade

This is mandatory.

63. RESEARCH MODE
Create a research area where the user can investigate:

historical setups
similar market conditions
strategy versions
index performance
family performance
setup performance
regime performance
This helps prevent blindly trusting live signals.

64. METHODOLOGY PAGE
Create a transparent methodology page.

Explain:

How VoltaX analyzes markets
How signals are qualified
How reliability is calculated
How risk is calculated
How backtesting works
How historical comparisons work
What AI does
What AI does NOT do

Include an explicit disclaimer that statistical reliability is not a guarantee of future performance.

65. DEPLOYMENT
The application should eventually be deployable to a modern cloud platform.

Separate:

development
staging
production

Use environment-specific configuration.

Do not make deployment depend on a developer's local machine.

66. OBSERVABILITY
Implement structured logs.

Track:

errors
connection state
analysis duration
signal generation duration
API failures
database failures
notification failures
execution failures
Avoid excessive logging on every tick.

Use meaningful events.

67. COST CONTROL
Avoid unnecessarily expensive AI calls.

AI explanations should generally be generated:

when a signal qualifies
when the user explicitly requests an explanation
when an important signal state changes
Do not send every market tick to an AI model.

The deterministic engine handles continuous analysis.

68. AI PROMPT SAFETY
AI explanation prompts should contain structured verified facts.

Example:

{
  "instrument": "...",
  "direction": "...",
  "structure": {...},
  "setup": {...},
  "entry": {...},
  "risk": {...},
  "statistics": {...}
}

Instruct the model:

Do not introduce facts not present in the supplied data.
Do not predict guaranteed outcomes.
Do not alter numerical values.
Do not create unsupported technical reasons.
Explain the existing algorithmic decision.

69. FUTURE EXTENSIBILITY
Architect for future additions:

additional users
subscriptions
additional brokers
additional markets
strategy variants
mobile app
advanced AI research
additional notification providers
automated strategy optimization
Do not implement those prematurely.

Build clean interfaces so they can be added later.

70. INITIAL USER
The first deployment is intended for:

ONE USER — THE OWNER
However, the database and authorization architecture should not make future multi-user support difficult.

71. IMPORTANT IMPLEMENTATION RULE
If you encounter ambiguity:

Prefer the safest implementation.
Prefer the simplest maintainable architecture.
Prefer deterministic behavior.
Do not invent financial assumptions.
Verify external API semantics using current official documentation.
Clearly document assumptions.
Never silently make a risky decision.
72. DEVELOPMENT ORDER
Build in this order unless a better dependency-aware order is technically justified:

STEP 1
Inspect repository and environment.

STEP 2
Initialize application architecture.

STEP 3
Configure TypeScript, linting, testing, formatting.

STEP 4
Create Supabase schema and migrations.

STEP 5
Implement authentication.

STEP 6
Implement Deriv integration.

STEP 7
Implement market-data engine.

STEP 8
Implement candle/timeframe engine.

STEP 9
Implement analytical primitives.

STEP 10
Implement index-family profiles.

STEP 11
Implement market-structure engine.

STEP 12
Implement setup engine.

STEP 13
Implement entry engine.

STEP 14
Implement precision-entry engine.

STEP 15
Implement risk engine.

STEP 16
Implement signal engine.

STEP 17
Implement signal persistence and lifecycle.

STEP 18
Implement radar.

STEP 19
Implement charts.

STEP 20
Implement backtesting engine.

STEP 21
Implement performance analytics.

STEP 22
Implement paper trading.

STEP 23
Implement live trading with safety controls.

STEP 24
Implement notifications.

STEP 25
Implement AI explanations.

STEP 26
Implement historical pattern research.

STEP 27
Polish dashboard UX.

STEP 28
Security audit.

STEP 29
Performance optimization.

STEP 30
Full test suite.

STEP 31
Deployment preparation.

73. HOW YOU SHOULD WORK WITH CLAUDE CODE
You are operating as an autonomous senior engineer, but do not make destructive assumptions.

At the beginning:

Inspect the repository.

Then determine:

existing files
package manager
framework
current dependencies
environment
git state
existing code
available configuration
Do not overwrite useful existing work.

Before creating new infrastructure, determine whether it already exists.

74. COMMAND EXECUTION
Use the available terminal/tools to:

inspect files
create files
modify files
install dependencies
run tests
run lint
run type checking
run builds
inspect errors
fix errors
After implementing each subsystem, actually execute the relevant validation commands.

Do not merely tell me:

"This should work."

Verify it.

75. EXTERNAL DOCUMENTATION
When implementing Deriv API functionality, Supabase functionality, Next.js functionality, or other external APIs/frameworks whose current behavior matters:

Use the current official documentation where necessary.

Do not rely on stale assumptions.

In particular, verify:

Deriv authentication
Deriv WebSocket API
available synthetic indices
market-data endpoints
historical-data behavior
trading contract semantics
order execution
account permissions
rate limits
API changes
76. FINANCIAL SAFETY
This application is a trading tool.

Therefore:

Never assume profitability.
Never hide losses.
Never fabricate statistics.
Never fabricate historical data.
Never use future information in backtests.
Never execute live trades without explicit authorization.
Never expose credentials.
Never automatically increase risk after losses.
Never silently switch trading modes.
Never generate signals from stale market data.
When uncertain:

FAIL SAFE.
77. QUALITY STANDARD
The final product should feel like a serious software product, not a prototype.

Avoid:

placeholder buttons that pretend to work
fake charts
fake statistics
hard-coded signals
hard-coded market prices
fake API responses in production code
meaningless animations
excessive gradients
excessive neon
giant dashboards with no hierarchy
generic AI-generated UI
Everything visible as functional should actually connect to a real implementation or clearly be marked as unavailable/configuration-required.

78. ACCEPTANCE CRITERIA
The project is not complete until:

Infrastructure
 application runs locally
 production build succeeds
 TypeScript passes
 lint passes
 tests pass
 Supabase migrations work
 authentication works
Market data
 Deriv connection works
 instruments can be discovered
 live data works
 historical data works
 candles are correctly constructed
 stale data is detected
Analytics
 4H structure works
 1H structure works
 15M setup works
 5M confirmation works
 1M precision works
 index-family profiles work
 signal scoring works
Signals
 signals are persisted
 signal lifecycle works
 reasons are stored
 methodology version is stored
 no-signal state works
Backtesting
 historical replay works
 no-lookahead safeguards exist
 trades are simulated
 statistics calculate correctly
 performance is displayed
Trading
 paper trading works
 live trading is separated
 position sizing works
 risk limits work
 emergency stop works
 live execution requires explicit enablement
Notifications
 in-app works
 browser works
 Telegram works when configured
UX
 dark theme
 light theme
 responsive design
 beginner-friendly explanations
 accessible UI
 signal detail pages
 performance dashboard
 market radar
AI
 AI explanations use structured verified data
 AI cannot fabricate signal data
 AI failures do not break signal generation
Security
 secrets protected
 Deriv token never client-side
 RLS configured
 authorization enforced
 audit logging implemented
79. FIRST TASK
Do NOT immediately start generating random application code.

Your first response/action should be:

Inspect the repository.
Determine the current project state.
Determine what tooling is available.
Identify whether this is an empty project or existing application.
Produce a concise implementation plan based on what you find.
Identify any critical unknowns that genuinely block implementation.
If nothing critical blocks implementation, begin Phase 1 immediately.
Do not ask unnecessary questions.

Make sensible engineering decisions yourself.

80. WORKING STYLE
Be proactive.

When something is missing:

create it.
When something is broken:

diagnose it.
When a dependency is required:

install it if appropriate.
When an architectural decision is needed:

choose the most maintainable option and document it.
When a financial assumption is uncertain:

verify it.
When a feature is too large:

break it into testable modules.
Do not repeatedly ask the user for permission for ordinary engineering decisions.

Only stop and ask when the decision is genuinely consequential, ambiguous, destructive, or requires a secret/credential that cannot safely be inferred.

81. DO NOT FAKE PROGRESS
Never claim:

API integration complete
backtesting complete
trading complete
signals working
Telegram working
Supabase working
unless you actually implemented and verified it.

If an external credential is required and unavailable, implement the integration, configuration path, validation, and safe fallback, then clearly state what remains to be configured.

82. FINAL PRODUCT EXPERIENCE
The ideal user experience is:

Open VoltaX
Immediately see:

MARKET RADAR

27 Markets Scanned
8 Bullish
7 Bearish
12 Neutral
3 Qualified Opportunities

Then:

TOP OPPORTUNITIES

1. Volatility 75 — BUY
   Reliability 76%
   R:R 1:2.8

2. Boom 500 — SELL
   Reliability 72%
   R:R 1:2.4

3. Crash 300 — BUY
   Reliability 69%
   R:R 1:2.1

Click a market.

See:

4H
Bullish structure

1H
Bullish continuation

15M
Pullback into qualified zone

5M
Confirmation detected

1M
Precision entry available

Then:

Why?

VoltaX explains the decision.

Then:

Historical Evidence

Show sample size and historical outcomes.

Then:

Risk

Show exactly how much would be risked.

Then the user chooses:

[ PAPER TRADE ]

or

[ ENABLE LIVE TRADE ]

The system never forces the trade.

83. BUILD PHILOSOPHY
The fundamental architecture should be:

DATA
 ↓
FEATURES
 ↓
STRUCTURE
 ↓
SETUP
 ↓
CONFIRMATION
 ↓
PRECISION
 ↓
RISK
 ↓
STATISTICS
 ↓
SIGNAL
 ↓
EXPLANATION
 ↓
ALERT
 ↓
PAPER / LIVE EXECUTION
 ↓
RESULT
 ↓
PERFORMANCE DATA
 ↓
RESEARCH
 ↓
IMPROVEMENT

This creates a closed research loop.

VoltaX should continuously answer:

What did we see?

Why did we generate the signal?

What happened afterward?

How often does this setup work?

Under what conditions does it work?

When does it fail?

Which index families behave differently?

Is the methodology actually improving?

That is more important than simply generating more signals.

84. BEGIN NOW
Start by inspecting the repository and environment.

Then build VoltaX incrementally according to the architecture above.

Do not build a superficial mockup.

Build the actual system.

Prioritize correctness, safety, explainability, statistical validity, maintainability, and real integration over speed.

When a feature cannot yet be connected to a real external service because credentials/configuration are unavailable, build the production-ready abstraction and configuration path rather than fabricating a successful connection.

At every stage, test what you build.

Your objective is to turn this specification into a working, extensible VoltaX trading intelligence platform.

One important recommendation: paste this into Claude Code at the root of a new Git repository, rather than into a normal Claude chat. Let Claude inspect the environment first, and keep the project under Git so you can checkpoint each major phase.

For the actual build, I would also have Claude Code create a CLAUDE.md containing the permanent project rules above, while keeping the master prompt as the initial architectural directive. This prevents later coding sessions from gradually drifting away from the VoltaX methodology.


