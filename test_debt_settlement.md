# Debt Settlement Test Case

## Scenario
- Group of 4 people: A, B, C, D
- A adds a $40 expense (equal split: $10 each)
- B and C settle up with A
- A adds another $40 expense (equal split: $10 each)
- Expected result: B and C owe $10 each, D owes $20

## Test Steps

1. **Create Group with 4 participants**
2. **Add first $40 expense**
   - A pays $40
   - B owes A $10
   - C owes A $10  
   - D owes A $10
   - A owes A $10 (net: A is owed $30)

3. **B settles with A**
   - B pays A $10
   - B's debt to A: $0
   - A is now owed $20

4. **C settles with A**
   - C pays A $10
   - C's debt to A: $0
   - A is now owed $10

5. **Add second $40 expense**
   - A pays $40
   - B owes A $10
   - C owes A $10
   - D owes A $10
   - A owes A $10 (net: A is owed $30)
   - But B and C have already paid $10 each, so:
     - B owes A $10 (new $10 - $10 paid = $0, but new expense adds $10)
     - C owes A $10 (new $10 - $10 paid = $0, but new expense adds $10)
     - D owes A $20 (new $10 + previous $10)

## Expected Final State
- B owes A $10
- C owes A $10
- D owes A $20
- Total: A is owed $40 (which matches the total expenses A paid minus what A owes)
