import logging
import sys

def setup_logging() -> logging.Logger:
    logger = logging.getLogger("ticket.app")

    if logger.handlers:
        return logger
    
    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.propagate = False

    return logger