"""Errors raised by the channels module."""


class ChannelError(Exception):
    """Base error for channel operations."""


class ChannelConfigurationError(ChannelError):
    """Raised when a provider account is not configured."""


class ChannelDeliveryError(ChannelError):
    """Raised when a provider rejects or cannot deliver a message."""

