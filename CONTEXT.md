# Assets

Tracks the organization's equipment: where it is, how it moves, and, for equipment, how it is maintained.

## Language

**Sector**:
Organizational unit an equipment item is assigned to.
_Avoid_: Department, place, room

**Location**:
Free text that pinpoints the equipment inside the sector — a room, reception, a corridor.
_Avoid_: Complement, room

**Equipment**:
IT item tracked by the system, with an asset tag, category, and maintenance.
_Avoid_: Asset, item

**Regular maintenance**:
Periodic service required by the category, measured in days. The first count starts on the equipment registration date. A completed maintenance restarts the count on the completion date.
_Avoid_: Warranty, service
