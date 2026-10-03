from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    openai_api_key: str
    allowed_origin: str = "http://localhost:3000"
    vision_model: str = "gpt-5-nano"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


config = Config()
