FROM python:3.11-slim

WORKDIR /app

# Build tools needed to compile medspacy native extensions (Cython, PyRuSH, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir medspacy spacy flask && \
    python -m spacy download en_core_web_sm

COPY app.py .

EXPOSE 8080

CMD ["python", "app.py"]
