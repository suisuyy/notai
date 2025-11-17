import { API_BASE_URL, AI_PROXY_URL } from '../../config.js';
import currentUser from '../../state/currentUser.js';

const mixin = {
  async apiRequest(method, endpoint, body = null, isAIRequest = false, noSpinner = false) {
    // Show the spinner before making the request
    if (!noSpinner) this.showSpinner();

    const headers = {
      "Content-Type": "application/json",
    };

    if (isAIRequest) {
      const model = this.aiSettings.models.find(m => m.model_id === body?.model);
      if (model?.api_key) {
        headers["Authorization"] = `Bearer ${model.api_key}`;
      }
    } else if (currentUser.userId && currentUser.credentials) {
      headers["Authorization"] = `Basic ${currentUser.credentials}`;
    }

    try {
      const url = isAIRequest
        ? AI_PROXY_URL
        : `${API_BASE_URL}${endpoint}`;

      let requestBody = body && typeof body === 'object' ? { ...body } : null;

      if (isAIRequest && requestBody?.model) {
        try {
          const rawElseConfig = this.aiSettings.models.find(m => m.model_id === requestBody.model)?.else || '{}';
          const elseconfig = JSON.parse(rawElseConfig);
          requestBody = { ...requestBody, ...elseconfig };
        } catch (error) {
          console.log('error when parse else config', error);
        }
      }

      const response = await fetch(
        isAIRequest && requestBody?.model
          ? (this.aiSettings.models.find(m => m.model_id === requestBody.model)?.url || AI_PROXY_URL)
          : url, {
        method,
        headers,
        body: method === 'GET' ? null : requestBody ? JSON.stringify(requestBody) : null,
      });

      // Hide the spinner after the request completes
      this.hideSpinner();
      if (isAIRequest) {
        return response;
      }
      else {
        let responseObject = await response.json();
        return responseObject;
      }

    } catch (error) {
      console.error("API Error:", error);
      this.hideSpinner(); // Ensure spinner is hidden on error
      return { error: "Network error" };
    }
  },
};

export default mixin;
