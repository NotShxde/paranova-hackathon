from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import instructor
import google.generativeai as genai
import os

from evaluators.sympy_kernel import evaluate_sympy
from evaluators.lean_kernel import evaluate_lean

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EvaluationRequest(BaseModel):
    hypothesis: str
    target: str
    theorem_id: str

class AIResponse(BaseModel):
    jidoka_halt: bool
    socratic_hint: str

def generate_ai_feedback(hypothesis: str, error_msg: str) -> AIResponse:
    if not os.environ.get("GEMINI_API_KEY"):
        return AIResponse(
            jidoka_halt=True,
            socratic_hint="[MOCK] Your hypothesis failed validation. Think about the boundaries of the variables. What happens if a side is extremely long?"
        )
    
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    # Note: instructor supports Gemini via the gemini API client.
    # To keep it robust for the MVP, we can configure instructor with google generative ai.
    try:
        client = instructor.from_gemini(
            client=genai.GenerativeModel(
                model_name="models/gemini-1.5-pro-latest",
            )
        )

        resp = client.chat.completions.create(
            response_model=AIResponse,
            messages=[
                {"role": "user", "content": f"The student submitted the hypothesis '{hypothesis}'. It failed with error: {error_msg}. Generate a Socratic refutation hint and a jidoka halt flag."}
            ]
        )
        return resp
    except Exception as e:
        print("Error with instructor gemini integration:", e)
        # Fallback if instructor Gemini integration has issues
        return AIResponse(
            jidoka_halt=True,
            socratic_hint=f"Your hypothesis failed validation. {error_msg}"
        )

@app.post("/api/evaluate")
async def evaluate(req: EvaluationRequest):
    is_valid = False
    error_msg = ""
    
    try:
        if req.target == "sympy":
            is_valid, error_msg = evaluate_sympy(req.hypothesis)
        elif req.target == "lean":
            is_valid, error_msg = evaluate_lean(req.hypothesis)
        else:
            raise HTTPException(status_code=400, detail="Invalid target")
    except Exception as e:
        is_valid = False
        error_msg = str(e)
        
    if is_valid:
        return {"success": True, "message": "Verification passed!"}
    
    feedback = generate_ai_feedback(req.hypothesis, error_msg)
    
    return {
        "success": False,
        "jidoka_halt": feedback.jidoka_halt,
        "socratic_hint": feedback.socratic_hint,
        "error_msg": error_msg
    }
