import unittest

from validate_training_data import validate_records


def row(record_id="a", split="train", content="Answer"):
    return {
        "id": record_id,
        "source": "curated-example",
        "license": "permission-record-001",
        "split": split,
        "language": "en",
        "review_status": "approved",
        "messages": [
            {"role": "user", "content": "Question"},
            {"role": "assistant", "content": content},
        ],
    }


class TrainingDataValidationTests(unittest.TestCase):
    def test_accepts_approved_record_with_provenance(self):
        self.assertEqual(validate_records([row()]), [])

    def test_rejects_missing_provenance_and_unreviewed_record(self):
        item = row()
        item.pop("license")
        item["review_status"] = "pending"
        errors = validate_records([item])
        self.assertTrue(any("license" in error for error in errors))
        self.assertTrue(any("only approved" in error for error in errors))

    def test_rejects_duplicate_ids(self):
        errors = validate_records([row("same"), row("same", content="Different")])
        self.assertTrue(any("duplicate id" in error for error in errors))

    def test_rejects_exact_duplicate_across_splits(self):
        errors = validate_records([row("train", "train"), row("test", "test")])
        self.assertTrue(any("crosses train" in error for error in errors))

    def test_rejects_non_assistant_final_turn(self):
        item = row()
        item["messages"][-1]["role"] = "user"
        self.assertTrue(any("final message" in error for error in validate_records([item])))

    def test_rejects_invalid_split(self):
        self.assertTrue(any("split must" in error for error in validate_records([row(split="holdout")])))
        

if __name__ == "__main__":
    unittest.main()
