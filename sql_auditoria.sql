SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM
  information_schema.triggers;
