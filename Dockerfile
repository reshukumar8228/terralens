FROM node:24-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY tokens.css /build/tokens.css
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/backend \
    OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 MKL_NUM_THREADS=2 \
    TERRALENS_MAX_SAMPLES=1000 TERRALENS_RUNTIME=/tmp/terralens-runtime
WORKDIR /app
COPY requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt
COPY backend/ ./backend/
COPY artifacts/ ./artifacts/
COPY --from=frontend /build/frontend/dist/ ./frontend/dist/
RUN useradd --create-home terralens && chown -R terralens:terralens /app
USER terralens
EXPOSE 8000
CMD ["sh", "-c", "uvicorn terralens.app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
