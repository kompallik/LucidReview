FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir medspacy spacy flask && \
    python -m spacy download en_core_web_sm

COPY app.py .

EXPOSE 8080

CMD ["python", "app.py"]
