package com.example.ekyc.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class OtpVerificationDto {

    @NotBlank(message = "OTP is required")
    @Pattern(regexp = "^[0-9]{6}$", message = "OTP must be exactly 6 numeric digits")
    private String otp;

    @NotBlank(message = "Reference number is required")
    private String referenceNumber;

    public OtpVerificationDto() {}

    public OtpVerificationDto(String otp, String referenceNumber) {
        this.otp = otp;
        this.referenceNumber = referenceNumber;
    }

    public String getOtp() {
        return otp;
    }

    public void setOtp(String otp) {
        this.otp = otp;
    }

    public String getReferenceNumber() {
        return referenceNumber;
    }

    public void setReferenceNumber(String referenceNumber) {
        this.referenceNumber = referenceNumber;
    }
}