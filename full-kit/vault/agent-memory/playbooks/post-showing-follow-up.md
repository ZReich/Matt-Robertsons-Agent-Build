---
type: agent-memory
category: business
memory_type: playbook
title: Post-Showing Follow-Up
priority: high
last_updated: "2026-03-01"
created: "2026-03-01"
---

# Playbook: Post-Showing Follow-Up

Triggered after a property showing is completed.

## Steps

1. **Log the showing** (auto)
   - Create communication record (channel: meeting, direction: outbound)
   - Link to deal and client
   - Include any notes from the showing

2. **Draft follow-up email to prospect** (approve)
   - Use post-showing-follow-up template
   - Personalize with property-specific details
   - Include next steps and any materials discussed
   - Submit for Matt's approval

3. **Update client/owner** (approve)
   - Draft showing summary for listing client
   - Include prospect's interest level and feedback
   - Any concerns or questions raised

4. **Create follow-up todos** (log-only)
   - "Send requested materials to {prospect}" — due next day
   - "Follow up on {property} showing interest" — due in 5 days
   - "Update {client} on showing activity" — due in 2 days

5. **Update deal notes** (log-only)
   - Add showing summary to deal file
   - Note prospect's interest level (hot/warm/cold)

## Timing
- Follow-up email: Within 24 hours of showing
- Client update: Within 48 hours
- Second follow-up if no response: 5 business days
