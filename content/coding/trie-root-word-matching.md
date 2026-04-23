# Trie Root Word Matching

## NEXT THING TO SAY

I need to replace each word with the shortest dictionary root. I will use a trie because it lets me walk each word character by character and stop as soon as I hit a root.

<div class="visual-demo">
  <div class="visual-demo-title">Trie traversal stops at shortest root</div>
  <div class="array-demo">
    <div class="array-cell hot">c</div><div class="array-cell hot">a</div><div class="array-cell hot">t</div><div class="array-cell">t</div><div class="array-cell">l</div><div class="array-cell">e</div>
  </div>
</div>

## 0) Two-Line Problem Framing

- We are given dictionary root words and a sentence.
- We must replace each sentence word with the shortest matching root.

## 1) Constraints First (Ask 4-6 Sharp Questions)

- Should shortest root win? My answer: yes.
- Are words lowercase? My answer: assume yes.
- Can no root match? My answer: keep original word.
- Can the dictionary be empty? My answer: yes.
- Should punctuation be handled? My answer: assume simple space-separated words unless stated.

Given these **constraints**, repeated prefix scans may not scale, so I will use a trie.

## 2) Brute Force First (No Code)

For each word, check every dictionary root to see if it is a prefix.

It is correct because it tests all roots. It is too slow with many roots and many words.

- Time: roughly words times roots times root length, O(w * r * L).
- Space: constant extra space, O(1), besides output.

## 3) Name the Pattern Early

The pattern is trie prefix search.

## 4) Optimized Approach (Structured Reasoning)

Build a trie from roots. For each word, walk the trie until a root marker is found or the path breaks.

The **invariant** is: the current trie node represents the prefix we have consumed so far.

Alternative not chosen: sorting roots by length and checking prefixes. It is simpler, but can still repeat work.

Compared with brute force, this turns repeated root checks into character traversal. Time becomes linear in dictionary characters plus sentence characters, O(total characters). Space becomes linear in dictionary characters, O(total root characters).

## 5) Complexity (Plain English + Big-O)

- Time is linear in total characters, O(total characters).
- Space is linear in dictionary characters, O(total root characters).
- Trie build plus word traversal dominate runtime.

## 6) Tradeoffs (Simple)

Trie uses more memory, but it avoids repeatedly checking every root.

## 7) Dry Run Before Coding

Normal example: roots `["cat", "bat", "rat"]`, sentence `"the cattle was rattled"` becomes `"the cat was rat"`.

**edge case**: if no root matches, keep the original word.

## 8) Python Code (TWO VERSIONS REQUIRED)

### 8A) Initial Clean Solution (No helpers unless truly needed)

```python
# Define the solution class.
class Solution:

    # Define the replace words method.
    def replace_words(self, dictionary, sentence):

        # Store the trie root.
        trie = {}

        # Insert each root word.
        for root in dictionary:

            # Start at the trie root.
            node = trie

            # Visit each character in the root.
            for character in root:

                # Create the next node when missing.
                node = node.setdefault(character, {})

            # Mark the end of a root.
            node["#"] = root

        # Store replaced words.
        replaced = []

        # Visit each word in the sentence.
        for word in sentence.split():

            # Start at the trie root.
            node = trie

            # Store the chosen replacement.
            replacement = word

            # Visit each character in the word.
            for character in word:

                # Stop if the character path is missing.
                if character not in node:

                    # Stop searching this word.
                    break

                # Move to the next trie node.
                node = node[character]

                # Check if a root ends here.
                if "#" in node:

                    # Store the shortest root.
                    replacement = node["#"]

                    # Stop at the shortest root.
                    break

            # Add the replacement.
            replaced.append(replacement)

        # Join the replaced words.
        return " ".join(replaced)

# Define the main function.
def main():

    # Store dictionary roots.
    dictionary = ["cat", "bat", "rat"]

    # Store the sample sentence.
    sentence = "the cattle was rattled"

    # Store the expected answer.
    expected = "the cat was rat"

    # Run the solution.
    actual = Solution().replace_words(dictionary, sentence)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

### 8B) Refactored Version (Small helpers, not extensive)

```python
# Define the solution class.
class Solution:

    # Define a helper that builds the trie.
    def build_trie(self, dictionary):

        # Store the trie root.
        trie = {}

        # Insert each root word.
        for root in dictionary:

            # Start at the trie root.
            node = trie

            # Visit each character.
            for character in root:

                # Create or reuse the child node.
                node = node.setdefault(character, {})

            # Store the root marker.
            node["#"] = root

        # Return the trie.
        return trie

    # Define the replace words method.
    def replace_words(self, dictionary, sentence):

        # Build the trie.
        trie = self.build_trie(dictionary)

        # Store the output words.
        output = []

        # Visit each sentence word.
        for word in sentence.split():

            # Start from the trie root.
            node = trie

            # Store the replacement.
            replacement = word

            # Visit each character.
            for character in word:

                # Stop if the path is missing.
                if character not in node:

                    # Stop searching.
                    break

                # Move to the child node.
                node = node[character]

                # Check for a completed root.
                if "#" in node:

                    # Store the root.
                    replacement = node["#"]

                    # Stop searching.
                    break

            # Add the replacement.
            output.append(replacement)

        # Return the final sentence.
        return " ".join(output)

# Define the main function.
def main():

    # Store dictionary roots.
    dictionary = ["cat", "bat", "rat"]

    # Store the sample sentence.
    sentence = "the cattle was rattled"

    # Store the expected answer.
    expected = "the cat was rat"

    # Run the solution.
    actual = Solution().replace_words(dictionary, sentence)

    # Print the expected and actual values.
    print("expected:", expected, "actual:", actual)

# Run the sample test.
main()
```

Refactor keeps the same complexity, it mainly improves readability.

## 9) Edge Case Validation

- **edge cases**: empty dictionary.
- **edge cases**: no matching roots.
- **edge cases**: multiple matching roots.
- **edge cases**: repeated spaces if the interviewer asks about exact formatting.

## 10) Final Complexity + Final Tradeoffs (Brief)

Linear time in characters, O(total characters). Linear trie space, O(total root characters). Trie uses memory for faster prefix matching.

## Follow-up Interview Questions

**Q: Why stop at the first root marker?**  
A: Because the first marker during traversal is the shortest matching root.

**Q: What if punctuation matters?**  
A: I would tokenize more carefully instead of using simple `split()`.
