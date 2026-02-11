---
name: demand-gen
description: Multi-channel demand generation, paid media optimization, SEO strategy, and partnership programs for Series A+ startups. Includes CAC calculator, channel playbooks, HubSpot integration, and international expansion tactics. Use when planning demand generation campaigns, optimizing paid media, building SEO strategies, establishing partnerships, or when user mentions demand gen, paid ads, LinkedIn ads, Google ads, CAC, acquisition, lead generation, or pipeline generation.
---

# Marketing Demand & Acquisition

Expert acquisition playbook for Series A+ startups scaling internationally (EU/US/Canada) with hybrid PLG/Sales-Led motion.

## Tools

### CAC Calculator
```bash
python scripts/calculate_cac.py
```
Calculates customer acquisition cost across channels with blended metrics.

## Core KPIs by Role

| Role | Key Metrics |
|------|-------------|
| **Demand Gen** | MQL/SQL volume, cost per opportunity, marketing-sourced pipeline $, MQL→SQL conversion |
| **Paid Media** | CAC, ROAS, CPL, CPA, incrementality lift, channel efficiency ratio |
| **SEO** | Organic sessions, non-brand traffic %, keyword rankings, organic-assisted conversions |
| **Partnerships** | Partner-sourced pipeline $, partner CAC, net new logos via partners |

## Channel Strategy Matrix

| Channel | Best For | CAC Benchmark | Series A Priority |
|---------|----------|---------------|-------------------|
| **LinkedIn Ads** | B2B, Enterprise, ABM | $150-$400 | ⭐⭐⭐⭐⭐ |
| **Google Search** | High-intent, BOFU | $80-$250 | ⭐⭐⭐⭐⭐ |
| **Google Display** | Retargeting, awareness | $50-$150 | ⭐⭐⭐ |
| **Meta (FB/IG)** | SMB, consumer-like products | $60-$200 | ⭐⭐⭐ |

## Budget Allocation (Series A Recommended)

**EU Markets**: 40% LinkedIn, 25% Google, 20% SEO, 15% Partnerships
**US/Canada**: 35% Google, 30% LinkedIn, 20% SEO, 15% Partnerships

## Campaign Brief Template

```
Campaign Name: [Q2-2025-LinkedIn-ABM-Enterprise]
Objective: [Generate 50 SQLs from Enterprise accounts ($50k+ ACV)]
Budget: [$15k/month]
Duration: [90 days]
Channels: [LinkedIn Ads, Retargeting, Email]
Audience: [Director+ at SaaS companies, 500-5000 employees, EU/US]
Offer: [Gated Industry Benchmark Report]
Success Metrics:
  - Primary: 50 SQLs, <$300 CPO
  - Secondary: 500 MQLs, 10% MQL→SQL rate
HubSpot Setup:
  - Campaign ID: [create in HubSpot]
  - Lead scoring: +20 for download, +30 for demo request
  - Attribution: First-touch + Multi-touch
Handoff Protocol:
  - SQL criteria: Title + Company size + Budget confirmed
  - Routing: Enterprise SDR team via HubSpot workflow
  - SLA: 4-hour response time
```

## UTM Parameter Structure

```
utm_source={channel}       // linkedin, google, facebook
utm_medium={type}          // cpc, display, email, organic
utm_campaign={campaign-id} // q2-2025-linkedin-abm-enterprise
utm_content={variant}      // ad-variant-a, email-1
utm_term={keyword}         // [for paid search only]
```

## International Expansion

**EU Market Entry**:
- GDPR: Double opt-in, explicit consent tracking in HubSpot
- Localization: DE, FR, ES priority
- Display prices in EUR
- LinkedIn most effective for B2B EU

**US/Canada**:
- Messaging: Direct, ROI-focused
- Google Ads + LinkedIn equal priority
- Case studies with $ impact
- Faster sales cycles, immediate lead follow-up

## LinkedIn Campaign Structure

```
Account
└─ Campaign Group: [Q2-2025-Enterprise-ABM]
   ├─ Campaign 1: [Awareness - Thought Leadership]
   ├─ Campaign 2: [Consideration - Product Education]
   └─ Campaign 3: [Conversion - Demo Requests]
```

**Targeting**: Company Size 50-5000, Director+, Software/SaaS industries
**Budget**: Start $50/day per campaign, scale 20% weekly if CAC < target

## Google Ads Campaign Types (Priority Order)

1. Search - Brand (protect brand terms)
2. Search - Competitor (steal market share)
3. Search - Solution (problem-aware buyers)
4. Display - Retargeting (re-engage warm traffic)

## Scaling Rules

1. CAC < target → Increase budget 20% weekly
2. CAC > target → Pause, optimize, relaunch
3. Conversion rate drops >20% → Check landing page, offer fatigue
4. Scale winners, kill losers fast (2-week test minimum)

## Partner Program Tiers

| Tier | Requirements | Benefits |
|------|--------------|----------|
| **Referral** | Register, pass quiz | 10% commission, portal access |
| **Silver** | 2 deals/quarter, certification | 15% commission, co-marketing |
| **Gold** | 5 deals/quarter, dedicated team | 20% commission, MDF, joint planning |
| **Platinum** | $100k+ revenue/year | 25% commission, executive sponsor, custom programs |

## Attribution Model (W-Shaped)

- First touch: 30% (awareness)
- Lead creation: 30% (conversion)
- Opportunity creation: 30% (sales-ready)
- Additional touches: 10% (distributed)
