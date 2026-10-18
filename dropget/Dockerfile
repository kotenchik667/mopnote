FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir --pre -r requirements.txt
COPY server.py .
COPY static/ ./static/
ENV PATH="/opt/venv/bin:${PATH}" PYTHONUNBUFFERED=1
EXPOSE 10000
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]
