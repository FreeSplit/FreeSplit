# Simple Debt Settlement Test

## Test Steps

1. **Create a group with 3 participants: A, B, C**
2. **Add expense: A pays $30 (equal split)**
   - Expected: B owes A $10, C owes A $10
3. **B settles with A: B pays A $10**
   - Expected: B owes A $0, C owes A $10
4. **Add another expense: A pays $30 (equal split)**
   - Expected: B owes A $10, C owes A $20

## Current Issue
The settlements are not being preserved when new expenses are added.

## Root Cause
The debt calculation algorithm is clearing all debts and recreating them, losing the paid amounts.

## Solution
Implement a system that preserves paid amounts across debt recalculations.
