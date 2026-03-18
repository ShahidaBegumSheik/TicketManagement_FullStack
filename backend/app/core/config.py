from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(default="mysql+pymysql://root:root@127.0.0.1:3306/py_ticket", alias="DATABASE_URL")


    jwt_secret_key: str = Field(default="change_me'", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")

    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    
    cors_origins: str = Field(default="http://localhost:5173,http://127.0.0.1:5173", alias="CORS_ORIGINS")

    seed_admin: bool = Field(default=True, alias="SEED_ADMIN")
    admin_email: str = Field(default="admin@gmail.com", alias="ADMIN_EMAIL")
    admin_password: str = Field(default="admin1234", alias="ADMIN_PASSWORD")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]
    
settings = Settings()

    


