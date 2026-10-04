from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    openai_api_key: str
    allowed_origin: str = "http://localhost:3000"
    vision_model: str = "gpt-5-nano"
    elevenlabs_api_key: str = ""
    elevenlabs_agent_id: str = ""
    director_model: str = "gpt-5-nano"
    map_model: str = "gpt-5-nano"
    elevenlabs_debrief_agent_id: str = ""
    elevenlabs_tutor_agent_id: str = ""
    tutor_model: str = "gpt-5-nano"
    tutor_judge_model: str = "gpt-5-nano"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


config = Config()
