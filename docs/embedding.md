# What actually happens when we create embeddings?

When you create embeddings, an AI model converts your text into a list of numbers (a vector) that represents the meaning and context of that text.

## The complete process

```text
Input text
"Diabetes can cause high blood sugar levels."
    ↓
Tokenization
Split text into tokens the model understands.
    ↓
Embedding model
Neural network processes the tokens and their context.
    ↓
Numerical vector
For example, 384 or 768 or 1,536 numbers, depending on the model.
    ↓
Vector database
Store the vector alongside its original text and metadata.
```

## Step one: Tokenization

Suppose your healthcare document contains:

```text
Diabetes can cause high blood sugar levels.
```

Before the neural network processes the text, a tokenizer splits it into tokens. A token might be a whole word, part of a word, punctuation, or another text unit.

For illustration, imagine the tokens are:

```text
Diabetes
can
cause
high
blood
sugar
levels
.
```

Illustrative tokenization only. The actual tokens depend on the tokenizer.

The tokenizer converts these tokens into integer IDs, for example:

```text
[1842, 317, 920, 611, 438, 725, 1290, 13]
```

### How does a token get its ID?

The tokenizer already has a vocabulary.

Suppose a tokenizer has this simplified vocabulary:

| Token | ID |
|---|---|
| play | 101 |
| ##ing | 102 |
| playing | 103 |
| doctor | 104 |
| ##s | 105 |

These IDs are illustrative. The `##` notation is used by some WordPiece tokenizers to indicate a continuation subword.

The important thing is that a real tokenizer does not necessarily choose the longest possible word or always split words into their smallest pieces. Its specific algorithm determines the result.

### How does it decide the split?

There are several common tokenization algorithms.

**A. WordPiece**

Used by BERT-style tokenizers. It uses a learned vocabulary and a greedy longest-match strategy to split words into available subwords, following the tokenizer's rules.

**B. Byte Pair Encoding (BPE)**

Common in GPT-style tokenizers. During tokenizer training, frequent character or byte sequences are merged into larger units. At inference time, the learned merge rules determine the segmentation.

**C. SentencePiece / Unigram**

Uses a learned subword vocabulary and scoring procedure to choose a segmentation. Depending on the configuration, alternative segmentations may also be possible.

## Step two: Token IDs become numerical representations

This is where the real neural-network processing begins.

Each token ID is used to retrieve a learned vector from an embedding matrix inside the model.

Imagine the model has an embedding matrix with 50,000 rows and 768 columns.

- 50,000 rows: one for each token in its vocabulary.
- 768 columns: 768 learned numerical values for each token.

For example, a simplified embedding lookup might look like this:

Token embedding matrix (illustrative)

| Token | Dimension 1 | Dimension 2 | Dimension 3 | … |
|---|---|---|---|---|
| Diabetes | 0.12 | -0.43 | 0.87 | … |
| blood | 0.51 | 0.18 | -0.26 | … |
| sugar | -0.31 | 0.72 | 0.44 | … |

Values are invented for illustration. Actual embedding values are learned by the model.

The model retrieves a vector for each token. If the embedding dimension is 768, each token starts with a 768-number vector.

### How does that ID select the embedding vector?

Now suppose the embedding matrix is `E`, with one row for each vocabulary token.

If the tokenizer produces token ID 9102, the model performs:

```text
x = E[9102]
```

That retrieves row 9102 of the matrix.

For example, if each row contains four numbers:

```text
E = [
  [0.12, -0.31,  0.08,  0.44],
  [-0.22, 0.45,  0.17,  0.09],
  [0.38,  0.11, -0.27,  0.52],
  [0.21, -0.14,  0.63, -0.08],
  [0.29, -0.19,  0.33,  0.16]
]

E[9102] = [0.21, -0.14, 0.63, -0.08]
```

## Step three: The neural network processes context

Modern embedding models often use Transformer architectures. Their layers process the token vectors and use mechanisms such as self-attention to incorporate information from other tokens.

```text
Token vectors
One vector per token
    ↓
Self-attention
Each token can incorporate information from relevant surrounding tokens.
    ↓
Transformer layers
Repeated mathematical operations transform the representations.
    ↓
Contextual token vectors
Representations now incorporate sentence context.
```

Inside these layers, the model performs operations involving matrix multiplication, attention scores, weighted combinations, nonlinear functions, and learned parameters.

These operations help the model distinguish the context of "bank" in the two sentences.

One subtle point: not every embedding model uses exactly this architecture. Some models use pooling or other mechanisms to produce the final sentence representation.

## Step four: How do we get ONE vector for the entire sentence?

So far, we have a vector for each token. But for semantic search in RAG, we usually want one vector for an entire chunk of text.

An embedding model converts the token representations into a single fixed-size vector using a method such as:

- Mean pooling: Average the contextual token vectors.
- CLS pooling: Use a designated classification token's representation, when appropriate for the model.
- Projection or other pooling: Transform or combine the representations according to the model's design.

## But how does the model know which numbers represent similar meanings?

This is the most important part.

The embedding model has usually been trained on large amounts of text using learning objectives designed to produce useful representations.

Depending on the model, training can involve:

1. Reading text and learning linguistic relationships.
2. Learning from pairs of sentences that are similar or dissimilar.
3. Adjusting model parameters so related texts receive useful vector representations.
4. Repeating this process across many training examples.

For example, a model trained for semantic similarity might learn to place these sentences relatively close together.

## The key distinction to remember

| Stage | What actually happens |
|---|---|
| Tokenization | Text becomes token IDs. |
| Token embeddings | Token IDs retrieve learned vectors. |
| Neural network | Contextual information transforms the vectors. |
| Pooling/projection | Token representations become one fixed-size text vector. |
| Training | Learned parameters are optimized to produce useful representations. |
| Vector search | The database compares vectors to find relevant content. |

In one sentence: An embedding is the output of a trained neural network that maps text into a numerical vector space, making semantic relationships measurable through mathematical comparisons.

## Pretrained Embedding Models — How They Actually Work

The most important concept to understand is this:

A pretrained embedding model is a neural network whose parameters have already been learned during training. You reuse those learned parameters to convert new text into vectors. You don't train the model from scratch every time you embed a document.

Conceptually, several things happen.

### Step 1: Load the model files

The library obtains the model's files from its local cache or downloads them if necessary.

### Step 2: Read the configuration

The architecture, tokenizer settings, layer sizes, and other model-specific details are loaded.

### Step 3: Load learned weights

The trained numerical parameters are loaded into the neural network.

### Step 4: Prepare for inference

The model is ready to process new text and calculate embeddings, without ordinary training updates.

## What did the model learn before you downloaded it?

Imagine that a model's training process involved millions of text examples and a learning objective designed to produce useful sentence representations.

During training, it repeatedly:

1. Processes training text.
2. Produces internal representations.
3. Calculates a training loss.
4. Computes gradients using backpropagation.
5. Updates its parameters with an optimizer.

After many training steps, the learned parameters are saved as model weights.

## Why don't we train the embedding model ourselves?

For your RAG platform, this distinction matters.

| Approach | What you do | When to use it |
|---|---|---|
| Use a pretrained model | Download and run existing learned weights | Most RAG applications |
| Fine-tune a pretrained model | Further train it on domain-specific examples | When retrieval quality needs improvement |
| Train from scratch | Learn model parameters from an initial state | Specialized research or large-scale model development |

For your healthcare RAG system, start with a pretrained model. You can evaluate retrieval quality first and consider fine-tuning later if you have suitable training data and a clear performance gap.
