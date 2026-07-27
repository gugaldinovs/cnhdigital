// Pixel Tracking & Meta Events Integration
// Integração com Meta Pixel e API de Payments

window.PixelTracking = {
  pixelId: '2291640938255149',
  checkoutToken: window.CHECKOUT_TOKEN,
  apiBaseUrl: 'https://api.sigmapayments.com.br/api/v1',
  eventDeduplicationCookies: {},

  // Inicializar tracking de eventos
  init() {
    this.setupMetaPixelEvents();
    this.setupCheckoutTracking();
  },

  // Configurar eventos do Meta Pixel
  setupMetaPixelEvents() {
    if (!window.fbq) return;

    // PageView - já disparado no HTML
    console.log('✅ Meta Pixel PageView enviado');
  },

  // Iniciar checkout - disparado quando usuário começa a preencher formulário
  trackInitiateCheckout(productLink, value) {
    if (window.fbq) {
      fbq('track', 'InitiateCheckout', {
        value: value / 100, // converter de centavos para reais
        currency: 'BRL',
        content_name: productLink,
        content_type: 'product'
      });
    }

    // Enviar também via Conversions API
    this.sendMetaServerEvent('InitiateCheckout', productLink, {
      value: value / 100,
      currency: 'BRL'
    });
  },

  // Adicionar ao carrinho / selecionar produto
  trackAddToCart(productLink, value, quantity = 1) {
    if (window.fbq) {
      fbq('track', 'AddToCart', {
        value: (value * quantity) / 100,
        currency: 'BRL',
        content_name: productLink,
        content_type: 'product',
        quantity: quantity
      });
    }

    this.sendMetaServerEvent('AddToCart', productLink, {
      value: (value * quantity) / 100,
      currency: 'BRL',
      quantity: quantity
    });
  },

  // Adicionar info de pagamento
  trackAddPaymentInfo(productLink, paymentMethod) {
    if (window.fbq) {
      fbq('track', 'AddPaymentInfo', {
        content_name: productLink,
        content_type: 'product',
        payment_type: paymentMethod // pix, credit_card, bank_slip
      });
    }

    this.sendMetaServerEvent('AddPaymentInfo', productLink, {
      payment_method: paymentMethod
    });
  },

  // Compra realizada
  trackPurchase(transactionData) {
    const { transaction_id, total_value, email, product } = transactionData;

    if (window.fbq) {
      fbq('track', 'Purchase', {
        value: total_value / 100,
        currency: 'BRL',
        transaction_id: transaction_id,
        content_name: product?.title,
        content_type: 'product'
      });
    }

    this.sendMetaServerEvent('Purchase', product?.id, {
      value: total_value / 100,
      currency: 'BRL',
      userData: {
        em: this.hashEmail(email),
        country: 'BR'
      }
    });
  },

  // Enviar evento via Conversions API do Meta (server-side)
  async sendMetaServerEvent(eventName, productShortId, eventData) {
    try {
      const userData = eventData.userData || {};
      const response = await fetch(
        `${this.apiBaseUrl}/products/${productShortId}/metrics/meta`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            data: {
              eventName: eventName,
              eventTime: Date.now(),
              eventSourceUrl: window.location.href,
              actionSource: 'website',
              userData: userData
            }
          })
        }
      );

      const result = await response.json();
      if (!result.hasError) {
        console.log(`✅ Meta Server Event '${eventName}' enviado com sucesso`);
      }
    } catch (error) {
      console.error(`❌ Erro ao enviar Meta Server Event '${eventName}':`, error);
    }
  },

  // Criar pagamento via API
  async createPayment(paymentData) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/payments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(paymentData)
        }
      );

      const result = await response.json();

      if (!result.hasError) {
        console.log('✅ Pagamento criado:', result.data.transaction_id);
        this.trackPurchase(result.data);
        return result.data;
      } else {
        console.error('❌ Erro ao criar pagamento:', result);
        return null;
      }
    } catch (error) {
      console.error('❌ Erro na requisição de pagamento:', error);
      return null;
    }
  },

  // Consultar status do pagamento com polling
  async pollPaymentStatus(transactionId, maxAttempts = 20, interval = 15000) {
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(
          `${this.apiBaseUrl}/payments/${transactionId}/status`
        );
        const result = await response.json();

        if (!result.hasError) {
          const status = result.data.status;
          console.log(`📊 Status do pagamento: ${status}`);

          if (status === 'AUTHORIZED' || status === 'APPROVED') {
            console.log('✅ Pagamento aprovado!');
            return { success: true, data: result.data };
          } else if (status === 'REJECTED' || status === 'FAILED') {
            console.log('❌ Pagamento recusado/falhou');
            return { success: false, data: result.data };
          } else if (status === 'PENDING') {
            attempts++;
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, interval));
              return poll();
            } else {
              return { success: false, message: 'Timeout no polling' };
            }
          }
        }
      } catch (error) {
        console.error('❌ Erro ao consultar status:', error);
      }
    };

    return poll();
  },

  // Hash de email para GDPR
  hashEmail(email) {
    if (!email) return '';
    const text = email.toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  },

  // Obter UTMs salvos
  getUTMs() {
    return window._getUtms?.() || {};
  },

  // Setup para rastreamento de checkout
  setupCheckoutTracking() {
    // Event listeners para quando o usuário interage com o formulário
    document.addEventListener('input', (e) => {
      if (e.target.name === 'paymentMethod') {
        const method = e.target.value;
        if (method) {
          this.trackAddPaymentInfo('checkout', method);
        }
      }
    });
  }
};

// Inicializar ao carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.PixelTracking.init();
  });
} else {
  window.PixelTracking.init();
}
