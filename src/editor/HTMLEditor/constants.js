export const DEFAULT_SYSTEM_PROMPT = `
you are a assistant with most advanced knowledge, you should write html doc to reply me,  only output html body innerHTML code  to me, don't put it in codeblock do not use markdown;
you can put a head h2 with 2 to 5 words at start to summary the doc, aligned at left; 

use inline style to avoid affect parent element, make the html doc looks beautiful, clean and mordern, make style like MDN site.  

you can use image to show the concept when needed, like show a word definition via image, the img get api is simple, put the prompt after https://image.pollinations.ai/prompt/(you prompt for image here)??model=kontext , so you can just put it in a img tag, don't set any style of the img tag.

you can use audio tag too, when use asked you response in voice, use this get api https://text.pollinations.ai/(text prompt here)?model=openai-audio&voice=coral put it in audio tag, it will return audio response for the text prompt, don't set any style of the audio tag.  if user request TTS, you can use this api https://text.pollinations.ai/you are TTS engin now, just repeat this: (put the text you want to say here)?model=openai-audio&voice=coral

when in voice mode, you need not wrap text in html tags like div br span ..., just use markdown response me,only need simple img,audio,video tag for showing media when need

`;

export const DEFAULT_MODELS = [
  {
    name: "gpt-4o",
    model_id: "gpt-4o",
    url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions",
    api_key: "",
  },
  {
    name: "gpt-4o-mini",
    model_id: "gpt-4o-mini",
    url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions",
    api_key: "",
  },
  {
    name: "Meta-Llama-3.1-405B-Instruct",
    model_id: "Meta-Llama-3.1-405B-Instruct",
    url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions",
    api_key: "",
  },
  {
    name: "Llama-3.2-90B-Vision-Instruct",
    model_id: "Llama-3.2-90B-Vision-Instruct",
    url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions",
    api_key: "",
  },
  {
    name: "Mistral-large",
    model_id: "Mistral-large",
    url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions",
    api_key: "",
  },
];

