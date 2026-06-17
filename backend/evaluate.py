import math
import copy

def evaluate_urban_economy(faces):
    """
    Evaluates the urban economy metrics for the given faces.
    Ported from rules/evaluate.ts.
    """
    # Clone the faces to prevent modifying the inputs in-place
    cloned_faces = copy.deepcopy(faces)
    
    # 1. Create a map for fast lookup of faces by ID
    face_map = {face['id']: face for face in cloned_faces}
    
    # 2. First pass: Calculate value for all residentials
    for face in cloned_faces:
        state = face.setdefault('state', {})
        state['value'] = state.get('value', 0)
        state['population'] = state.get('population', 0)
        
        evaluation = face.setdefault('evaluation', {})
        evaluation['score'] = evaluation.get('score', 0)
        
        if state.get('built_type') != 'residential':
            continue
            
        value = 40  # Base value baseline score
        
        # Scan neighbors
        for neighbor_id in face.get('neighbors', []):
            neighbor = face_map.get(neighbor_id)
            if neighbor:
                neighbor_type = neighbor.get('state', {}).get('built_type', '')
                if neighbor_type in ('park', 'greenway', 'green'):
                    value += 25  # Large green bonus
                elif neighbor_type == 'residential':
                    value -= 5   # Residential crowding penalty
                    
        state['value'] = max(10, min(100, value))
        
    # 3. Second pass: Calculate population based on normal distribution
    mu = 60       # Golden price point for population
    sigma = 20    # Sensitivity coefficient
    P_max = 150   # Maximum population capacity per grid
    
    total_city_population = 0
    total_developer_profit = 0
    
    for face in cloned_faces:
        state = face.get('state', {})
        evaluation = face.get('evaluation', {})
        
        if state.get('built_type') == 'residential':
            v = state.get('value', 0)
            
            # Gaussian/normal distribution formula
            pop = P_max * math.exp(-((v - mu) ** 2) / (2 * (sigma ** 2)))
            rounded_pop = round(pop)
            
            state['population'] = rounded_pop
            evaluation['score'] = v  # Value is used as score for front-end display
            
            total_city_population += rounded_pop
            total_developer_profit += rounded_pop * v
        else:
            state['value'] = 0
            state['population'] = 0
            evaluation['score'] = 0
            
    # 4. Third pass: Calculate total government tax
    tax_rate = 0.5
    total_government_tax = round(total_city_population * tax_rate)
    
    return {
        "faces": cloned_faces,
        "government_tax": total_government_tax,
        "developer_profit": total_developer_profit,
        "total_population": total_city_population
    }
