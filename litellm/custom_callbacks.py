import os
import requests
import traceback

def send_to_backend(
    kwargs,
    completion_response,
    start_time,
    end_time
):
    try:
        litellm_params = kwargs.get("litellm_params", {})
        metadata = litellm_params.get("metadata", {})
        
        # The user_api_key is the virtual key the user provides
        user_api_key = kwargs.get("user_api_key")
        response_cost = kwargs.get("response_cost", 0)

        if not user_api_key or response_cost <= 0:
            return

        backend_url = os.getenv("USAGE_CALLBACK_URL")
        backend_token = os.getenv("USAGE_CALLBACK_TOKEN")

        if not backend_url or not backend_token:
            print("USAGE_CALLBACK_URL or USAGE_CALLBACK_TOKEN not set. Skipping callback.")
            return

        data = {
            "user_api_key": user_api_key,
            "cost_in_usd": response_cost,
            "model": kwargs.get("model"),
            "prompt_tokens": completion_response.usage.prompt_tokens if completion_response.usage else 0,
            "completion_tokens": completion_response.usage.completion_tokens if completion_response.usage else 0,
            "total_tokens": completion_response.usage.total_tokens if completion_response.usage else 0,
            "duration_ms": (end_time - start_time).total_seconds() * 1000,
            "litellm_model_id": completion_response.model,
            "provider": "litellm" # Or extract from model if possible
        }

        headers = {
            "Authorization": f"Bearer {backend_token}",
            "Content-Type": "application/json"
        }

        requests.post(backend_url, json=data, timeout=5)

    except Exception as e:
        print(f"Error in custom callback: {e}")
        traceback.print_exc()