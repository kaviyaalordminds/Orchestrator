from app.services.chat_intent import ChatMode, classify_chat


def test_greeting_bypasses_vault():
    assert classify_chat("Hi") == ChatMode.DIRECT
    assert classify_chat("Hello!") == ChatMode.DIRECT
    assert classify_chat("How are you?") == ChatMode.DIRECT


def test_general_question_bypasses_vault():
    assert classify_chat("Explain recursion in simple terms.") == ChatMode.DIRECT
    assert classify_chat("What is a Python list?") == ChatMode.DIRECT


def test_internal_question_uses_vault():
    assert classify_chat("What is my mental model?") == ChatMode.VAULT
    assert classify_chat("What did I decide for the project architecture?") == ChatMode.VAULT
    assert classify_chat("Show me my previous trades.") == ChatMode.VAULT
