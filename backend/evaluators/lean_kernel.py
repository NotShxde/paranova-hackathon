import subprocess
import tempfile
import os

def evaluate_lean(hypothesis: str):
    """
    Evaluates a Lean 4 formal proof tactic string.
    Returns (is_valid: bool, error_msg: str)
    """
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".lean", delete=False, mode="w") as f:
            f.write(hypothesis)
            tmp_path = f.name
            
        # Call Lean 4 headless
        result = subprocess.run(
            ["lean", tmp_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            return True, ""
        else:
            return False, result.stderr or result.stdout
            
    except subprocess.TimeoutExpired:
        return False, "Lean evaluation timed out."
    except Exception as e:
        return False, f"Lean kernel error: {str(e)}"
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
