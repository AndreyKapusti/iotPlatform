import unittest
from datetime import datetime, timedelta, timezone

from app.automation import ensure_acyclic, evaluate, validate_definition


class AutomationLogicTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc)
        self.caps = {
            (1, "humidity"): {"role": "sensor", "data_type": "number"},
            (2, "relay"): {"role": "actuator", "data_type": "boolean"},
            (3, "other"): {"role": "actuator", "data_type": "boolean"},
            (4, "temperature"): {"role": "sensor", "data_type": "number"},
        }
        self.leaf = {"left": {"device_id": 1, "metric": "humidity"}, "operator": "gt", "right": {"kind": "literal", "value": 50}}
        self.rule = {"condition": {"op": "all", "children": [self.leaf]}, "then": [{"device_id": 2, "metric": "relay", "value": True}], "otherwise": []}

    def test_freshness_and_comparison(self):
        self.assertTrue(evaluate(self.rule["condition"], {(1, "humidity"): (60, self.now)}, self.now, 30)[0])
        self.assertIsNone(evaluate(self.rule["condition"], {(1, "humidity"): (60, self.now - timedelta(seconds=30))}, self.now, 30)[0])
        self.assertFalse(evaluate(self.rule["condition"], {(1, "humidity"): (40, self.now)}, self.now, 30)[0])

    def test_unknown_or_input_suspends_rule(self):
        condition = {"op": "any", "children": [self.leaf, {"left": {"device_id": 2, "metric": "relay"}, "operator": "eq", "right": {"kind": "literal", "value": True}}]}
        self.assertEqual(evaluate(condition, {(1, "humidity"): (60, self.now)}, self.now, 30), (None, None))

    def test_reference_to_another_device_and_nested_group(self):
        comparison = {"left": {"device_id": 1, "metric": "humidity"}, "operator": "gt", "right": {"kind": "reference", "device_id": 4, "metric": "temperature"}}
        nested = {"op": "all", "children": [{"op": "any", "children": [comparison]}]}
        rule = {**self.rule, "condition": nested}
        validate_definition(rule, self.caps)
        readings = {(1, "humidity"): (60, self.now), (4, "temperature"): (40, self.now)}
        self.assertTrue(evaluate(nested, readings, self.now, 30)[0])
        self.assertIsNone(evaluate(nested, {(1, "humidity"): (60, self.now)}, self.now, 30)[0])

    def test_only_matching_types_and_boolean_actuators(self):
        validate_definition(self.rule, self.caps)
        invalid = {**self.rule, "then": [{"device_id": 1, "metric": "humidity", "value": True}]}
        with self.assertRaises(ValueError):
            validate_definition(invalid, self.caps)
        invalid = {**self.rule, "condition": {"op": "all", "children": [{**self.leaf, "right": {"kind": "literal", "value": True}}]}}
        with self.assertRaises(ValueError):
            validate_definition(invalid, self.caps)

    def test_cycle_across_rules_is_rejected(self):
        def rule(source, target):
            return {"condition": {"op": "all", "children": [{"left": source, "operator": "eq", "right": {"kind": "literal", "value": True}}]}, "then": [{**target, "value": False}], "otherwise": []}
        relay = {"device_id": 2, "metric": "relay"}
        other = {"device_id": 3, "metric": "other"}
        with self.assertRaises(ValueError):
            ensure_acyclic([rule(relay, other), rule(other, relay)], self.caps)
        ensure_acyclic([rule(relay, other)], self.caps)


if __name__ == '__main__':
    unittest.main()
