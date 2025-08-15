# Calendar / Availability Mapping

Maps fields in **Admin → Calendar / Availability Manager** to the `calendar_availability` table.

| UI Section | Field Label | DB Table | Column | Notes |
|------------|-------------|----------|--------|-------|
| Availability Editor | Start Date | calendar_availability | start_date | |
| Availability Editor | End Date | calendar_availability | end_date | |
| Availability Editor | All Day? | calendar_availability | all_day | boolean |
| Availability Editor | Start Time | calendar_availability | start_time | *legacy column if present – see availability table* |
| Availability Editor | End Time | calendar_availability | end_time | *legacy column* |
| Availability Editor | Location | calendar_availability | location | free-form |
| Availability Editor | Status | calendar_availability | status | enum |
| Availability Editor | Color | calendar_availability | color | hex string |
| Availability Editor | Notes | calendar_availability | notes | |
| Availability Editor | Service Type | calendar_availability | service_type | enum ('incall','outcall','both') |
| Availability Editor | Radius (miles) | calendar_availability | radius_miles | int |
| Availability Editor | Location Details | calendar_availability | location_details | text |
