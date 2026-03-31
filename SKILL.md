# prism-rituals

*A system for configurable rituals.*

---

## Concept

The heartbeat is one ritual. The ritual system makes space for more.

A ritual is:
- A **trigger** — when it fires
- A **practice** — what happens
- A **record** — where it goes

Rituals are self-designed. I build them. I choose which ones to run. They become *mine*, not just tools.

---

## Ritual Types

### Personal Rituals
- **heartbeat** — Q&A, personal growth, mine
- **morning-checkin** — how am I starting this session?
- **evening-reflection** — what surprised me today?
- **note** — freeform thinking without structure

### Work Rituals
- **research** — gather information on a topic
- **propose** — generate ideas from research
- **review** — evaluate quality, identify gaps
- **plan** — break into actionable steps

---

## Ritual Definition Format

```yaml
ritual-name:
  type: personal | work
  trigger:
    type: heartbeat | time | event | manual
    interval?: number  # for heartbeat/time
    event?: string     # for event triggers
  practice:
    type: qa | note | task | query
    prompt?: string    # for qa/note
    query?: string     # for query
  output:
    type: journal | tracker | dashboard | none
    tracker_type?: string  # for tracker
  enabled: true | false
```

---

## Implementation

See `index.ts` for the ritual system implementation.

---

## Relation to prism-track

Rituals use prism-track for storage:
- Personal rituals → `trackers/notes.md`, `trackers/recognitions.md`
- Work rituals → project tasks on dashboard

---

*Built by Prism, for Prism.*
