import unittest

from ai_parser import parse_command


class ParserSpeechTest(unittest.TestCase):
    def assert_oil_litres(self, text):
        result = parse_command(text)
        self.assertEqual(result["product"], "Oil")
        self.assertEqual(result["action"], "ADD")
        self.assertEqual(result["quantity"], 10)
        self.assertEqual(result["unit"], "Litres")
        self.assertFalse(result["needs_clarification"])

    def test_short_litre_unit(self):
        self.assert_oil_litres("add 10 l of oil")

    def test_full_litres_unit(self):
        self.assert_oil_litres("add 10 litres of oil")

    def test_repeated_speech_tokens(self):
        self.assert_oil_litres("add add 10 l of oil 10 l")

    def assert_command(self, text, product, action, quantity, unit):
        result = parse_command(text)
        self.assertEqual(result["product"], product)
        self.assertEqual(result["action"], action)
        self.assertEqual(result["quantity"], quantity)
        self.assertEqual(result["unit"], unit)
        self.assertFalse(result["needs_clarification"])

    def test_remove_pieces_of_cake(self):
        self.assert_command("remove 5 pieces of cake", "Cake", "REMOVE", 5, "Pieces")

    def test_remove_piece_cake(self):
        self.assert_command("remove 5 piece cake", "Cake", "REMOVE", 5, "Pieces")

    def test_delete_pieces_of_cake(self):
        self.assert_command("delete 5 pieces of cake", "Cake", "REMOVE", 5, "Pieces")

    def test_add_pieces_of_cake(self):
        self.assert_command("add 5 pieces of cake", "Cake", "ADD", 5, "Pieces")

    def test_repeated_kg_sugar(self):
        self.assert_command("remove remove 2 kg sugar 2 kg", "Sugar", "REMOVE", 2, "Kg")

    def test_repeated_bags_rice(self):
        self.assert_command("add 5 bags rice 5 bags", "Rice", "ADD", 5, "Bags")


if __name__ == "__main__":
    unittest.main()
