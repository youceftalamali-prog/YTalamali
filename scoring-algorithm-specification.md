# AuraPost AI - Opportunity Scoring Algorithm Specification

The **Opportunity Scoring Engine** analyzes multi-dimensional product data, e-commerce catalog signals, consumer search trends, and competitor saturation to calculate a unified **Opportunity Score ($S_{opp}$)** out of 100. This specification outlines the formulas, variables, and mathematical constraints utilized by the engine.

---

## 1. Mathematical Equation Overview

The overall **Opportunity Score ($S_{opp}$)** is a dynamic, weighted aggregation of four core sub-indices:
1.  **Demand Score ($S_{dem}$)**
2.  **Competition Score ($S_{comp}$)**
3.  **Trend Score ($S_{trend}$)**
4.  **Profitability Score ($S_{prof}$)**

$$S_{opp} = (W_{dem} \cdot S_{dem}) + (W_{comp} \cdot S_{comp}) + (W_{trend} \cdot S_{trend}) + (W_{prof} \cdot S_{prof})$$

### Fixed Core Weights
Where the weighting vector $\mathbf{W}$ is balanced as follows:
-   $W_{dem} = 0.35$ (The direct leading driver)
-   $W_{comp} = 0.25$ (Lower competition raises optimization limits)
-   $W_{trend} = 0.20$ (Captures directional growth momentum)
-   $W_{prof} = 0.20$ (Asserts baseline commercial margin safety)

---

## 2. In-Depth Sub-Index Calculus

### 2.1 Demand Score ($S_{dem}$)
Calculates market pull. It aggregates transaction run-rates, estimated keywords monthly search volume, and social interaction velocity.

$$S_{dem} = \min\left(100, \, 40 \cdot \log_{10}(V_{search} + 10) + 30 \cdot \left(\frac{T_{sales}}{T_{sales} + 15}\right) + 30 \cdot \left(\frac{I_{social}}{I_{social} + 50}\right)\right)$$

Where:
-   $V_{search}$: Monthly localized search volume for leading keywords (scaled logarithmically).
-   $T_{sales}$: Product daily transaction velocity or order volume on source platform (AliExpress, Amazon, Shopify).
-   $I_{social}$: Normalized monthly social engagement (shares, hashtags, pins, mentions) associated with the item category.

---

### 2.2 Competition Score ($S_{comp}$)
Measures merchant saturation. A higher score represents a **more localized, less crowded, or less saturated niche** (favorable for newcomers). Thus, we invert competitive density.

$$S_{comp} = 100 \cdot \left(1.0 - C_{density}\right)^\gamma$$

Where:
-   $C_{density} \in [0.0, 1.0]$ represents the competitive density ratio:
    $$C_{density} = 0.4 \cdot \left(\frac{N_{sellers}}{N_{sellers} + 10}\right) + 0.3 \cdot A_{bid} + 0.3 \cdot S_{brand}$$
    -   $N_{sellers}$: Number of independent merchants actively advertising or selling the identical item.
    -   $A_{bid} \in [0.0, 1.0]$: Google Shopping/Amazon dynamic PPC bid cost index ($0$ is free, $1$ represents premium cost per click).
    -   $S_{brand}$: Unified market share of dominant established brands in the niche ($0$ means decentralized indie market, $1$ means complete monopoly by elite players).
-   $\gamma = 1.25$ is a shaping exponent which heavily penalizes items transitioning into overly saturated markets.

---

### 2.3 Trend Score ($S_{trend}$)
Traces short-term & long-term keyword momentum using historical velocity maps.

$$S_{trend} = \text{clamp}\left(50 + 25 \cdot \alpha_{short} + 25 \cdot \alpha_{long}, \, 0, \, 100\right)$$

Where:
-   $\alpha_{short}$ represents the short-term growth factor (past 30 days vs preceding 3 months):
    $$\alpha_{short} = \frac{V_{current} - V_{avg\_3m}}{V_{avg\_3m}}$$
-   $\alpha_{long}$ represents the year-over-year vector (past 3 months vs same 3-month block in the prior year):
    $$\alpha_{long} = \frac{V_{avg\_3m} - V_{prior\_y}}{V_{prior\_y}}$$

---

### 2.4 Profitability Score ($S_{prof}$)
Calculates pricing elasticity and gross target margin sustainability.

$$S_{prof} = 100 \cdot \left(\frac{P_{selling} - C_{good}}{P_{selling}}\right) \cdot \left(1.0 - e^{-\beta \cdot (P_{selling} - C_{good})}\right)$$

Where:
-   $P_{selling}$: Normalized user retail price.
-   $C_{good}$: Supplier/Ingested base acquisition cost (calculated via AliExpress or manual tags).
-   $\beta = 0.05$ represents a dampening factor to ensure low-ticket high-margin items ($5 item, $1 cost) do not outrank premium mid-ticket items ($60 item, $20 cost), balancing net profit volume alongside clean percentages.

---

## 3. Dynamic Quality Penalty Modifiers

Before writing down raw results, the unified score receives adjustment pass modifiers based on listing data anomalies.

| Data Defect Detected | Mathematical Adjustment Formula | Rationale |
| :--- | :--- | :--- |
| **No Product Image** | $S_{opp\_final} = S_{opp} \cdot 0.85$ | Lack of visual assets raises ad costs and limits placement. |
| **Thin Specifications** | $S_{opp\_final} = S_{opp} \cdot 0.90$ | Missing dimensions or weight reduces AI generation capabilities. |
| **Extremely Short Description** | $S_{opp\_final} = S_{opp} \cdot 0.95$ | Under-defined features lower model accuracy and training quality. |
| **Low Import Yield** | $S_{opp\_final} = S_{opp} \cdot 0.90$ | Low confidence data output tags. |

---

## 4. Confidence Calculations & Standard Deviations

To flag volatile data sources or predictions missing historical files, the engine outputs a **Confidence Score ($CS_{opp}$)** between $[0.0, 1.0]$. 

If the database detects that search inputs ($V_{search}$) or cost parameters ($C_{good}$) are missing, the confidence score drops below $0.70$. When this boundary is violated, the system appends user alerts advising the workspace to enhance product parameters and key attributes to stabilize scores.
