import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import shallow from 'zustand/shallow';

import { isSVODOffer } from '#src/utils/subscription';
import CheckoutForm from '#components/CheckoutForm/CheckoutForm';
import { addQueryParam, removeQueryParam } from '#src/utils/location';
import useForm from '#src/hooks/useForm';
import LoadingOverlay from '#components/LoadingOverlay/LoadingOverlay';
import PayPal from '#components/PayPal/PayPal';
import NoPaymentRequired from '#components/NoPaymentRequired/NoPaymentRequired';
import { addQueryParams } from '#src/utils/formatting';
import { useCheckoutStore } from '#src/stores/CheckoutStore';
import { createOrder, getPaymentMethods, paymentWithoutDetails, paypalPayment, updateOrder } from '#src/stores/CheckoutController';
import { reloadActiveSubscription } from '#src/stores/AccountController';
import PaymentForm from '#src/components/PaymentForm/PaymentForm';
import AdyenInitialPayment from '#src/containers/AdyenInitialPayment/AdyenInitialPayment';

const Checkout = () => {
  const location = useLocation();
  const { t } = useTranslation('account');
  const navigate = useNavigate();
  const [paymentError, setPaymentError] = useState<string | undefined>(undefined);
  const [updatingOrder, setUpdatingOrder] = useState(false);
  const [couponFormOpen, setCouponFormOpen] = useState(false);
  const [couponCodeApplied, setCouponCodeApplied] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState<number | undefined>(undefined);

  if (updatingOrder) {
    useCheckoutStore.setState({ purchasingOffers: null });
  }

  const { order, offer, paymentMethods, setOrder, purchasingOffer } = useCheckoutStore(
    ({ order, offer, paymentMethods, setOrder, purchasingOffers: purchasingOffer }) => ({
      order,
      offer,
      paymentMethods,
      setOrder,
      purchasingOffer,
    }),
    shallow,
  );

  const offerType = offer && !isSVODOffer(offer) ? 'tvod' : 'svod';

  const paymentSuccessUrl = useMemo(() => {
    if (purchasingOffer) {
      return '/';
    }
    return offerType === 'svod' ? addQueryParam(location, 'u', 'welcome') : removeQueryParam(location, 'u');
  }, [location, offerType, purchasingOffer]);

  const couponCodeForm = useForm({ couponCode: '' }, async (values, { setSubmitting, setErrors }) => {
    setUpdatingOrder(true);
    setCouponCodeApplied(false);

    if (values.couponCode && order) {
      try {
        await updateOrder(order, paymentMethodId, values.couponCode);
        setCouponCodeApplied(true);
      } catch (error: unknown) {
        if (error instanceof Error) {
          if (error.message.includes(`Order with id ${order.id} not found`)) {
            navigate(addQueryParam(location, 'u', 'choose-offer'), { replace: true });
          } else {
            setErrors({ couponCode: t('checkout.coupon_not_valid') });
          }
        }
      }
    }

    setUpdatingOrder(false);
    setSubmitting(false);
  });

  const handleCouponFormSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setUpdatingOrder(true);
    setCouponCodeApplied(false);
    couponCodeForm.setErrors({ couponCode: undefined });
    if (couponCodeForm.values.couponCode && order) {
      try {
        await updateOrder(order, paymentMethodId, couponCodeForm.values.couponCode);
        setCouponCodeApplied(true);
      } catch (error: unknown) {
        if (error instanceof Error) {
          if (error.message.includes(`Order with id ${order.id} not found`)) {
            navigate(addQueryParam(location, 'u', 'choose-offer'), { replace: true });
          } else {
            couponCodeForm.setErrors({ couponCode: t('checkout.coupon_not_valid') });
          }
        }
      }
    }

    setUpdatingOrder(false);
    couponCodeForm.setSubmitting(false);
  };

  useEffect(() => {
    async function createNewOrder() {
      if (offer) {
        setUpdatingOrder(true);
        setCouponCodeApplied(false);
        const methods = await getPaymentMethods();

        setPaymentMethodId(methods[0]?.id);

        await createOrder(offer, methods[0]?.id);

        setUpdatingOrder(false);
      }
    }

    if (!offer) {
      return navigate(addQueryParam(location, 'u', 'choose-offer'), { replace: true });
    }

    // noinspection JSIgnoredPromiseFromCall
    createNewOrder();
  }, [location, navigate, offer]);

  // clear the order after closing the checkout modal
  useEffect(() => {
    return () => setOrder(null);
  }, [setOrder]);

  const backButtonClickHandler = () => {
    navigate(addQueryParam(location, 'u', 'choose-offer'));
  };

  const handlePaymentMethodChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const toPaymentMethodId = parseInt(event.target.value);

    setPaymentMethodId(toPaymentMethodId);
    setPaymentError(undefined);

    if (order && toPaymentMethodId) {
      setUpdatingOrder(true);
      setCouponCodeApplied(false);
      updateOrder(order, toPaymentMethodId, couponCodeForm.values.couponCode)
        .catch((error: Error) => {
          if (error.message.includes(`Order with id ${order.id}} not found`)) {
            navigate(addQueryParam(location, 'u', 'choose-offer'));
          }
        })
        .finally(() => setUpdatingOrder(false));
    }
  };

  const handleNoPaymentRequiredSubmit = async () => {
    try {
      setUpdatingOrder(true);
      setPaymentError(undefined);
      await paymentWithoutDetails();
      await reloadActiveSubscription({ delay: 1000 });
      navigate(paymentSuccessUrl, { replace: true });
    } catch (error: unknown) {
      if (error instanceof Error) {
        setPaymentError(error.message);
      }
    }

    setUpdatingOrder(false);
  };

  const handlePayPalSubmit = async () => {
    try {
      setPaymentError(undefined);
      setUpdatingOrder(true);
      const cancelUrl = addQueryParams(window.location.href, { u: 'payment-cancelled' });
      const errorUrl = addQueryParams(window.location.href, { u: 'payment-error' });
      const successUrl = `${window.location.origin}${paymentSuccessUrl}`;

      const response = await paypalPayment(successUrl, cancelUrl, errorUrl, couponCodeForm.values.couponCode);

      if (response.redirectUrl) {
        window.location.href = response.redirectUrl;
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setPaymentError(error.message);
      }
    }
    setUpdatingOrder(false);
  };

  const renderPaymentMethod = () => {
    const paymentMethod = paymentMethods?.find((method) => method.id === paymentMethodId);

    if (!order || !offer) return null;

    if (!order.requiredPaymentDetails) {
      return <NoPaymentRequired onSubmit={handleNoPaymentRequiredSubmit} error={paymentError} />;
    }

    if (paymentMethod?.methodName === 'card') {
      if (paymentMethod?.provider === 'stripe') {
        return <PaymentForm couponCode={couponCodeForm.values.couponCode} setUpdatingOrder={setUpdatingOrder} />;
      }

      return (
        <AdyenInitialPayment
          paymentSuccessUrl={paymentSuccessUrl}
          setUpdatingOrder={setUpdatingOrder}
          setPaymentError={setPaymentError}
          orderId={order.id}
          type="card"
        />
      );
    } else if (paymentMethod?.methodName === 'paypal') {
      return <PayPal onSubmit={handlePayPalSubmit} error={paymentError} />;
    }

    return null;
  };

  // loading state
  if (!offer || !order || !paymentMethods || !offerType) {
    return (
      <div style={{ height: 300 }}>
        <LoadingOverlay inline />
      </div>
    );
  }

  return (
    <CheckoutForm
      order={order}
      offer={offer}
      offerType={offerType}
      onBackButtonClick={backButtonClickHandler}
      paymentMethods={paymentMethods}
      paymentMethodId={paymentMethodId}
      onPaymentMethodChange={handlePaymentMethodChange}
      onCouponFormSubmit={handleCouponFormSubmit}
      onCouponInputChange={couponCodeForm.handleChange}
      onRedeemCouponButtonClick={() => setCouponFormOpen(true)}
      onCloseCouponFormClick={() => setCouponFormOpen(false)}
      couponInputValue={couponCodeForm.values.couponCode}
      couponFormOpen={couponFormOpen}
      couponFormApplied={couponCodeApplied}
      couponFormSubmitting={couponCodeForm.submitting}
      couponFormError={couponCodeForm.errors.couponCode}
      renderPaymentMethod={renderPaymentMethod}
      submitting={updatingOrder}
    />
  );
};

export default Checkout;
