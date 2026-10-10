"""Django ORM models（完全对应原 SQL schema）"""
from django.db import models


class User(models.Model):
    username = models.CharField(max_length=64, unique=True)
    password_hash = models.CharField(max_length=128)
    password_salt = models.CharField(max_length=64)
    permanent_code = models.CharField(max_length=16, unique=True)
    shop_name = models.CharField(max_length=128, null=True, blank=True)
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'users'


class QrSession(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'waiting'),
        ('connected', 'connected'),
        ('transferring', 'transferring'),
        ('completed', 'completed'),
        ('rejected', 'rejected'),
        ('expired', 'expired'),
    ]
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, db_column='user_id')
    code = models.CharField(max_length=16, unique=True)
    status = models.CharField(max_length=20, default='waiting')
    desktop_token = models.CharField(max_length=64)
    mobile_token = models.CharField(max_length=64, null=True, blank=True)
    expires_at = models.BigIntegerField()
    total_photos = models.IntegerField(default=0)
    received_photos = models.IntegerField(default=0)
    _created_at = models.BigIntegerField()
    _updated_at = models.BigIntegerField()

    class Meta:
        db_table = 'qr_sessions'
        indexes = [
            models.Index(fields=['user_id']),
            models.Index(fields=['expires_at']),
        ]


class QrPhoto(models.Model):
    STATUS_CHOICES = [
        ('uploading', 'uploading'),
        ('ready', 'ready'),
        ('received', 'received'),
    ]
    session = models.ForeignKey(QrSession, on_delete=models.CASCADE, db_column='session_id')
    file_name = models.CharField(max_length=512)
    file_size = models.BigIntegerField(default=0)
    download_url = models.CharField(max_length=1024)
    file_path = models.CharField(max_length=512, null=True, blank=True)
    bucket_id = models.CharField(max_length=128, null=True, blank=True)
    status = models.CharField(max_length=20, default='uploading')
    sort_order = models.IntegerField(default=0)
    _created_at = models.BigIntegerField()
    _updated_at = models.BigIntegerField()

    class Meta:
        db_table = 'qr_photos'


class QrSignal(models.Model):
    ROLE_CHOICES = [('desktop', 'desktop'), ('mobile', 'mobile')]
    TYPE_CHOICES = [('offer', 'offer'), ('answer', 'answer'), ('ice', 'ice')]
    session_code = models.CharField(max_length=16)
    role = models.CharField(max_length=16)
    type = models.CharField(max_length=16)
    payload = models.TextField()
    created_at = models.BigIntegerField()

    class Meta:
        db_table = 'qr_signals'
        indexes = [
            models.Index(fields=['session_code']),
        ]
