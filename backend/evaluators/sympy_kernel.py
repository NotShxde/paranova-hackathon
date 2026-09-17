import sympy

def evaluate_sympy(hypothesis: str):
    """
    Evaluates a sympy expression/inequality.
    Returns (is_valid: bool, error_msg: str)
    """
    try:
        from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application
        transformations = (standard_transformations + (implicit_multiplication_application,))
        
        expr = parse_expr(hypothesis, transformations=transformations, evaluate=False)
        
        if not isinstance(expr, sympy.Rel):
            return False, "Hypothesis must be a relational inequality (e.g., using > or <)."
            
        # For this minimal MVP, we consider any valid inequality successful.
        # In a full product, this would check equivalence against expected formal goals.
        return True, ""
    except Exception as e:
        return False, f"SymPy parsing error: {str(e)}"
