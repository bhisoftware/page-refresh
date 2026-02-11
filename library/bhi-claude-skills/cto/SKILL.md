---
name: cto
description: Technical leadership guidance for engineering teams, architecture decisions, and technology strategy. Includes tech debt analyzer, team scaling calculator, engineering metrics frameworks, technology evaluation tools, and ADR templates. Use when assessing technical debt, scaling engineering teams, evaluating technologies, making architecture decisions, establishing engineering metrics, or when user mentions CTO, tech debt, technical debt, team scaling, architecture decisions, technology evaluation, engineering metrics, DORA metrics, or technology strategy.
---

# CTO Advisor

## Tools

### Tech Debt Analyzer
```bash
python scripts/tech_debt_analyzer.py
```
Analyzes system architecture and provides prioritized debt reduction plan.

### Team Scaling Calculator
```bash
python scripts/team_scaling_calculator.py
```
Calculates optimal hiring plan and team structure for growth.

## Reference Files

| File | Purpose |
|------|---------|
| `references/architecture_decision_records.md` | ADR templates for documenting architecture decisions |
| `references/technology_evaluation_framework.md` | Vendor/technology selection framework |
| `references/engineering_metrics.md` | KPIs and DORA metrics implementation |

## Key Ratios for Team Scaling

- Manager:Engineer = 1:8
- Senior:Mid:Junior = 3:4:2
- Product:Engineering = 1:10
- QA:Engineering = 1.5:10

## DORA Metrics Targets

| Metric | Elite Target |
|--------|--------------|
| Deployment Frequency | >1/day |
| Lead Time | <1 day |
| MTTR | <1 hour |
| Change Failure Rate | <15% |

## Quality Metrics Targets

- Test Coverage: >80%
- Code Review: 100%
- Technical Debt: <10% capacity
- Unplanned Work: <20%

## Tech Debt Allocation

- Critical debt: 40% capacity
- High debt: 25% capacity
- Medium debt: 15% capacity
- Low debt: Ongoing maintenance

## Incident Response Timeline

1. **Immediate** (0-15 min): Assess severity, activate incident team, begin communication
2. **Short-term** (15-60 min): Implement fixes, update stakeholders, monitor
3. **Resolution** (1-24 hours): Verify fix, document timeline, customer communication
4. **Post-mortem** (48-72 hours): Root cause analysis, action items, process improvements

## Red Flags

- Increasing technical debt
- Rising attrition rate
- Slowing velocity
- Growing incidents
- Team morale declining
- Budget overruns
- Vendor dependencies
- Security vulnerabilities
