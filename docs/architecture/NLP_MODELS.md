# Marketing NLP Model Registry

This file documents the optional model weights used by Marketing NLP Feedback
Intelligence. Package dependencies are listed separately in `requirements-nlp.txt`.

## Primary Models

| NLP task | Model/component |
| --- | --- |
| English sentiment | `cardiffnlp/twitter-roberta-base-sentiment-latest` |
| Mixed/multilingual sentiment | `cardiffnlp/twitter-xlm-roberta-base-sentiment` |
| Semantic theme embeddings | `sentence-transformers/all-MiniLM-L6-v2` |
| Theme/keyphrase extraction | KeyBERT using SBERT embeddings |

## Fallbacks

| NLP task | Fallback |
| --- | --- |
| Sentiment | VADER |
| Themes | TF-IDF |

## Runtime Rules

- Do not download model weights at runtime.
- Transformer/SBERT loading must use `local_files_only=True`.
- Model weights must already exist in the local Hugging Face cache or a local
  model path available to the backend runtime.
- If model files or optional packages are unavailable, Marketing NLP must fall
  back gracefully to VADER sentiment and TF-IDF themes.
- PyTorch is installed separately according to the target CUDA/CPU environment.
  It is intentionally not pinned in `requirements-nlp.txt`.

## Tokenizer / Loading Notes

- RoBERTa, XLM-R, and SBERT model weights are cached through Hugging Face.
- XLM-R tokenizer requires `sentencepiece` and `protobuf`.
- `tiktoken` is included as a tokenizer conversion fallback dependency.
- Transformer model loading must use `use_safetensors=True`.
- Runtime should use `local_files_only=True` after model weights are cached.
