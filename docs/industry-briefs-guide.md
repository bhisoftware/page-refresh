# Industry Briefs — Agent Feedback Loop

Industry briefs are short, admin-written guidelines that agents receive when scoring and generating layouts for a specific industry. They let you shape agent behavior based on patterns you've observed across competitor benchmarks.

## How it works

1. **Score and comment on benchmarks** as usual — add observations about competitor sites (layout patterns, trust signals, design choices)
2. **Notice patterns** across competitors in the same industry
3. **Go to Industry Briefs** (admin nav tab) and write a concise brief distilling those patterns
4. **Agents use the brief** — the scoring agent receives your brief alongside its other inputs, which influences the design direction it gives to creative agents
5. **Revisit and refine** briefs as you add more benchmarks or notice the agents need adjustment

## Writing effective briefs

**Keep it concise.** 300-800 characters is the sweet spot. Agents have limited context and long briefs dilute the signal.

**Be specific and actionable.** Instead of "these sites are bad at trust," write:

> HVAC competitors in Nashville underinvest in trust signals. Top performers display Google review counts prominently in hero sections. Most use before/after photo grids for service work. Phone CTAs outperform form CTAs in this market.

**Focus on patterns, not individual sites.** The brief should capture what you've learned about the industry, not critique one specific competitor.

**Include what works, not just what's broken.** Agents need to know what good looks like for this industry.

## Where the brief goes in the pipeline

Your brief is passed to the **score agent** as `industryBrief` in its input payload. The score agent uses it to inform:

- The **creative brief** it generates (priorities, strengths, industry requirements)
- The **design direction** passed to creative agents
- The **content direction** that shapes copy and section choices

Creative agents don't receive the brief directly — they see its influence through the score agent's design direction. This keeps the feedback loop controlled and prevents overwhelming creative agents with too much context.

## Tips

- You can see resolved benchmark comments alongside the editor as reference
- The "Brief" column on the benchmarks list shows which industries have active briefs
- There's no limit on how often you update a brief — iterate as you learn
- If a brief isn't helping, remove it (the "Remove" button deletes it) and agents go back to their default behavior
