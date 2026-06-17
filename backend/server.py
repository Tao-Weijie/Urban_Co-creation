from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from backend.evaluate import evaluate_urban_economy

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend-server")

app = FastAPI(
    title="Urban Co-creation Backend API",
    description="Python calculations backend for urban economics modeling",
    version="1.0.0"
)

# Enable CORS for local Next.js development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EvaluationPayload(BaseModel):
    faces: list

@app.post("/api/py/evaluate")
def run_evaluation(payload: EvaluationPayload):
    """
    Receives grid faces, runs urban economics calculation, and returns metrics.
    """
    try:
        logger.info(f"Received evaluation request with {len(payload.faces)} faces.")
        result = evaluate_urban_economy(payload.faces)
        logger.info("Evaluation calculated successfully.")
        return result
    except Exception as e:
        logger.error(f"Error during evaluation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    """
    Health check endpoint.
    """
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
