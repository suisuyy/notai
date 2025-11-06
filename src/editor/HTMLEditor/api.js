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

      //get else from config and combine it to body
      let elseconfig = {}
      try {

        elseconfig = JSON.parse(this.aiSettings.models.find(m => m.model_id === body?.model)?.else || '{}');
        console.log('else config', elseconfig);
      } catch (error) {
        console.log('error when parse else config', error)
      }
      body = { ...body, ...elseconfig };
      const response = await fetch(
        isAIRequest && body?.model
          ? (this.aiSettings.models.find(m => m.model_id === body.model)?.url || AI_PROXY_URL)
          : url, {
        method,
        headers,
        body: method === 'GET' ? null : body ? JSON.stringify(body) : null,
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
