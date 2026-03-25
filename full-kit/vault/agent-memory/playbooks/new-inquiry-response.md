---
type: agent-memory
category: business
memory_type: playbook
title: New Inquiry Response
priority: high
last_updated: "2026-03-01"
created: "2026-03-01"
---

# Playbook: New Inquiry Response

Triggered when a new inquiry comes in (Crexi, LoopNet, email, referral, etc.)

## Steps

1. **Log the communication** (auto)
   - Create communication record with channel, contact, date
   - Tag with relevant deal if identifiable

2. **Check if contact exists** (auto)
   - Search clients and contacts for matching name/email/phone
   - If new: create client profile with available info

3. **Draft response email** (approve)
   - Use appropriate template (crexi-inquiry-response for listing inquiries)
   - Personalize with property details and contact name
   - Include: property highlights, availability for showing, Matt's contact info
   - Submit for Matt's approval before sending

4. **Create follow-up todo** (log-only)
   - "Follow up with {contact} re: {property}" due in 3 days
   - Priority: high

5. **Schedule showing if requested** (approve)
   - Check Matt's calendar for availability
   - Propose 2-3 time slots
   - Submit proposed times for approval

## Response Time Target
- During business hours (8am-6pm MT): Within 1 hour
- After hours: First thing next morning
- Weekends: By Monday 9am

## Template Variables
- `{{contact_name}}` — Inquiry sender's name
- `{{property_address}}` — Property they're asking about
- `{{property_type}}` — Type of property
- `{{listing_price}}` — If applicable
