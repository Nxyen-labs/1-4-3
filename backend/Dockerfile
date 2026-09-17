FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV, WeasyPrint, and geospatial libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libffi-dev \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Install lightweight CPU-only PyTorch to accelerate build and prevent OOM
RUN pip install --no-cache-dir torch==2.2.0 torchvision==0.17.0 --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Invalidate layer cache for application code
ARG BUILD_VERSION=20260917-3
ENV BUILD_VERSION=${BUILD_VERSION}

COPY . .

EXPOSE 10000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
